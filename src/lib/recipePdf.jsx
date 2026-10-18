// Recipe -> Letter-size PDF, client-side: render RecipePdfTemplate off-screen, snapshot
// it with html2canvas, paint the photo into its reserved box, then slice the bitmap
// into 8.5x11in pages with jsPDF (a long recipe flows onto more pages).
// Loaded on demand (dynamic import from RecipeDetail) so jspdf/html2canvas stay out of
// the main bundle.
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import RecipePdfTemplate from '../components/RecipePdfTemplate.jsx'
import { primaryCategory } from './categories.js'
import { isExternalImage } from './imageSnapshot.js'
import { withTimeout } from './image.js'

const PAGE_WIDTH = 816 // CSS px = 8.5in at 96dpi -> 612pt PDF page width
const PAGE_HEIGHT = 1056 // CSS px = 11in at 96dpi -> 792pt; the template's minHeight
const PAGE_TOP = 48 // top margin on continuation pages (the template's pt-12)
const PAGE_BOTTOM = 56 // bottom margin before a page break (the template's pb-14)
const PHOTO_RADIUS = 28 // the photo box's rounded-[28px]
const BG = '#FAF4E8'
const MAX_CANVAS_PIXELS = 16_000_000 // iOS Safari refuses canvases much bigger than this

function minutes(t) {
  if (!t || !t.value) return 0
  return Number(t.value) * (t.unit === 'hr' ? 60 : 1)
}

function timeText(mins) {
  if (!mins) return '—'
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  if (!h) return `${m} min`
  return m ? `${h} hr ${m} min` : `${h} hr`
}

// The photo as a decoded <img> read from its own bytes (a blob: URL), so drawing it
// never taints the canvas. Snapshotted photos live in Firebase Storage, which sends
// `access-control-allow-origin: *`, so a plain fetch works. A photo still on its
// original site is read through our own /api/image-fetch (the same proxy the
// snapshotter uses), then directly in case that site allows it (some block the proxy
// but send CORS headers). Any failure -> null, and the PDF is drawn without a photo
// rather than with a broken box; the reason is logged so a miss can be diagnosed.
async function loadPhoto(url) {
  if (!url) return null
  const proxy = /^https?:\/\//i.test(url) ? `/api/image-fetch?url=${encodeURIComponent(url)}` : null
  const sources = (isExternalImage(url) ? [proxy, url] : [url, proxy]).filter(Boolean)
  const misses = []
  for (const src of sources) {
    let objectUrl = null
    try {
      const resp = await withTimeout(fetch(src, { referrerPolicy: 'no-referrer' }), 15000, 'photo timed out')
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const blob = await resp.blob()
      if (!blob.type.startsWith('image/')) throw new Error(`not an image (${blob.type || 'no type'})`)
      objectUrl = URL.createObjectURL(blob)
      const img = new Image()
      img.src = objectUrl
      await withTimeout(img.decode(), 10000, 'photo decode timed out')
      if (!img.naturalWidth || !img.naturalHeight) throw new Error('photo has no size')
      return { img, release: () => URL.revokeObjectURL(objectUrl) }
    } catch (err) {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      misses.push(`${src.slice(0, 80)}: ${err?.message || err}`)
    }
  }
  console.warn('Recipe PDF: drawn without the photo.', misses)
  return null
}

// Paint the photo into the box the template reserved for it: cover-cropped and
// centred (what bg-cover bg-center did), clipped to the rounded corners.
function drawPhoto(ctx, img, box, scale) {
  const x = box.x * scale
  const y = box.y * scale
  const w = box.w * scale
  const h = box.h * scale
  const r = Math.min(PHOTO_RADIUS * scale, w / 2, h / 2)
  const iw = img.naturalWidth
  const ih = img.naturalHeight
  const k = Math.max(w / iw, h / ih)
  const sw = w / k
  const sh = h / k
  ctx.save()
  // html2canvas hands back its context still scaled and translated to the node's
  // (off-screen) page position; draw in plain canvas pixels instead.
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
  ctx.clip()
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h)
  ctx.restore()
}

// Where each page ends, in CSS px from the top of the sheet. A page is cut at the
// last line/block that still fits, never through one (a list item, a heading, the
// stat row, the photo). Page 1 keeps the sheet's own top padding;
// later pages get PAGE_TOP of fresh margin, so each holds a bit less.
function pageBreaks(blocks, total) {
  const breaks = []
  let start = 0
  while (total - start > (start ? PAGE_HEIGHT - PAGE_TOP : PAGE_HEIGHT)) {
    const limit = start + (start ? PAGE_HEIGHT - PAGE_TOP : PAGE_HEIGHT) - PAGE_BOTTOM
    // Two columns: moving the cut up to clear one line can land it inside a line of
    // the other column, so repeat until nothing straddles it.
    let cut = limit
    for (let moved = true; moved;) {
      moved = false
      for (const b of blocks) {
        if (b.top < cut && b.bottom > cut && b.top > start) { cut = b.top; moved = true }
      }
    }
    // A single block taller than a page can't be kept whole; cut at the limit.
    if (cut <= start + 1) cut = limit
    breaks.push(cut)
    start = cut
  }
  return breaks
}

function fileName(title) {
  const slug = (title || 'recipe').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${slug || 'recipe'}.pdf`
}

// recipe: the recipe as shown. ingredients: display lines in the reader's current
// scaled view (amount + unit + name). servings: the scaled servings label.
export async function buildRecipePdf({ recipe, ingredients, servings }) {
  const photo = await loadPhoto(recipe.imageUrl)
  const prep = minutes(recipe.prepTime)
  const cook = minutes(recipe.cookTime)

  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = `position:fixed;left:-${PAGE_WIDTH + 2000}px;top:0;width:${PAGE_WIDTH}px;pointer-events:none;`
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    flushSync(() => {
      root.render(
        <RecipePdfTemplate
          recipe={recipe}
          eyebrow={primaryCategory(recipe)}
          ingredients={ingredients}
          servings={servings}
          prep={timeText(prep)}
          cook={timeText(cook)}
          total={timeText(prep + cook)}
          hasPhoto={!!photo}
        />,
      )
    })
    // The serif title must be in Fraunces, not a fallback face, before the snapshot.
    await Promise.all([
      document.fonts.load('600 44px Fraunces'),
      document.fonts.load('800 15px Nunito'),
      document.fonts.load('400 15px Nunito'),
    ]).catch(() => {})
    await document.fonts.ready

    const node = host.firstElementChild
    const w = node.offsetWidth
    const h = node.offsetHeight
    const origin = node.getBoundingClientRect()
    const rel = (el) => {
      const r = el.getBoundingClientRect()
      return { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height }
    }
    const blocks = [...node.querySelectorAll('h1, h2, li, [data-pdf-keep], [data-pdf-photo]')].map((el) => {
      const r = rel(el)
      return { top: r.y - 4, bottom: r.y + r.h }
    })
    const photoEl = node.querySelector('[data-pdf-photo]')
    const photoBox = photoEl && rel(photoEl)

    // html2canvas finds each font's baseline by measuring a 1px <img> in a hidden
    // div it appends to <body>; Tailwind's preflight makes that img display:block,
    // which puts every line of text ~15px below where the layout (and so the page
    // breaks below) has it. Undo that for its probe only, while it snapshots.
    const probeFix = document.createElement('style')
    probeFix.textContent = 'body > div[style*="visibility: hidden"] > img { display: inline !important; }'
    document.head.appendChild(probeFix)
    const scale = Math.min(2, Math.sqrt(MAX_CANVAS_PIXELS / (w * h)))
    const canvas = await html2canvas(node, {
      scale,
      backgroundColor: BG,
      logging: false,
      width: w,
      height: h,
      windowWidth: PAGE_WIDTH,
    }).finally(() => probeFix.remove())
    if (photo && photoBox) drawPhoto(canvas.getContext('2d'), photo.img, photoBox, canvas.width / w)

    // 1 CSS px = 0.75pt, so an 816px-wide sheet is a true 8.5x11in page: text prints
    // and opens in Preview/Files at real size instead of shrunk to fit. A sheet taller
    // than one page is sliced into more pages of the same size, never squeezed.
    const px = canvas.width / w // canvas px per CSS px
    const wPt = PAGE_WIDTH * 0.75
    const hPt = PAGE_HEIGHT * 0.75
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: [wPt, hPt], compress: true })
    const cuts = [0, ...pageBreaks(blocks, h), h]
    const page = document.createElement('canvas')
    page.width = canvas.width
    page.height = Math.round(PAGE_HEIGHT * px)
    const pctx = page.getContext('2d')
    for (let i = 0; i < cuts.length - 1; i++) {
      const top = i ? PAGE_TOP : 0
      const sy = Math.round(cuts[i] * px)
      const sh = Math.min(Math.round(cuts[i + 1] * px), canvas.height) - sy
      pctx.fillStyle = BG
      pctx.fillRect(0, 0, page.width, page.height)
      pctx.drawImage(canvas, 0, sy, canvas.width, sh, 0, Math.round(top * px), canvas.width, sh)
      if (i) pdf.addPage([wPt, hPt], 'portrait')
      pdf.addImage(page.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, wPt, hPt, undefined, 'FAST')
    }
    pdf.setProperties({ title: recipe.title || 'Recipe' })
    const blob = pdf.output('blob')
    return new File([blob], fileName(recipe.title), { type: 'application/pdf' })
  } finally {
    root.unmount()
    host.remove()
    photo?.release()
  }
}
