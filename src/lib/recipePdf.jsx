// Recipe -> Letter-size PDF, client-side: measure the recipe's blocks off-screen, flow
// them snake-wise through two columns per 8.5x11in page (flowColumns), render those
// pages, snapshot each with html2canvas, paint the photo into its reserved box, and
// add each to a jsPDF document (a long recipe flows onto more pages).
// Loaded on demand (dynamic import from RecipeDetail) so jspdf/html2canvas stay out of
// the main bundle.
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { RecipePdfMeasure, RecipePdfPages, pdfBlocks, PDF_PAGE } from '../components/RecipePdfTemplate.jsx'
import { primaryCategory } from './categories.js'
import { isExternalImage } from './imageSnapshot.js'
import { withTimeout } from './image.js'

const PAGE_WIDTH = PDF_PAGE.width // CSS px = 8.5in at 96dpi -> 612pt PDF page width
const PAGE_HEIGHT = PDF_PAGE.height // CSS px = 11in at 96dpi -> 792pt
const PAGE_TOP = PDF_PAGE.top // top margin (page 1 has the header below it)
const PAGE_BOTTOM = PDF_PAGE.bottom // a column ends this far above the page's bottom edge
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

// The snake flow. Blocks go down the left column, then the right, then the next
// page's left, and so on, never split. Page 1's columns start under the header
// (firstTop); later pages start at PAGE_TOP. Method always opens a fresh column (the
// one after wherever Ingredients ended), and a heading never sits alone at the
// bottom of a column without its first line. Returns pages[p] = [{ i, col, y }].
function gapBefore(prev, b) {
  if (b.type === 'heading' || prev.type === 'photo') return 32
  if (prev.type === 'heading') return 12
  return b.type === 'step' ? 12 : 6
}

export function flowColumns(blocks, heights, firstTop) {
  const bottom = PAGE_HEIGHT - PAGE_BOTTOM
  const pages = [[]]
  let col = 0
  let y = firstTop
  let empty = true
  let prev = null
  const nextColumn = () => {
    if (++col === 2) { col = 0; pages.push([]) }
    y = pages.length > 1 ? PAGE_TOP : firstTop
    empty = true
  }
  blocks.forEach((b, i) => {
    if (b.section && !empty) nextColumn()
    let gap = empty ? 0 : gapBefore(prev, b)
    let need = gap + heights[i]
    if (b.type === 'heading' && i + 1 < blocks.length) need += gapBefore(b, blocks[i + 1]) + heights[i + 1]
    // A block taller than a whole column can't be kept whole; it gets a column of its
    // own and is clipped at the page edge.
    if (!empty && y + need > bottom) { nextColumn(); gap = 0 }
    pages[pages.length - 1].push({ i, col, y: y + gap })
    y += gap + heights[i]
    empty = false
    prev = b
  })
  return pages
}

function fileName(title) {
  const slug = (title || 'recipe').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${slug || 'recipe'}.pdf`
}

// recipe: the recipe as shown. ingredients: display lines in the reader's current
// scaled view (amount + unit + name). servings: the scaled servings label.
// Returns the PDF file plus each page as the JPEG data URL that went into it, so the
// in-app preview shows exactly what gets shared (iOS can't scroll a PDF in a page).
export async function buildRecipePdf({ recipe, ingredients, servings }) {
  const photo = await loadPhoto(recipe.imageUrl)
  const prep = minutes(recipe.prepTime)
  const cook = minutes(recipe.cookTime)

  const steps = recipe.instructions.filter((st) => st && st.trim())
  const blocks = pdfBlocks({ ingredients, steps, hasPhoto: !!photo })
  const header = {
    eyebrow: primaryCategory(recipe),
    title: recipe.title,
    servings,
    prep: timeText(prep),
    cook: timeText(cook),
    total: timeText(prep + cook),
  }

  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = `position:fixed;left:-${PAGE_WIDTH + 2000}px;top:0;width:${PAGE_WIDTH}px;pointer-events:none;`
  document.body.appendChild(host)
  const root = createRoot(host)
  // html2canvas finds each font's baseline by measuring a 1px <img> in a hidden
  // div it appends to <body>; Tailwind's preflight makes that img display:block,
  // which puts every line of text ~15px below where the layout has it. Undo that for
  // its probe only, while it snapshots.
  const probeFix = document.createElement('style')
  probeFix.textContent = 'body > div[style*="visibility: hidden"] > img { display: inline !important; }'
  try {
    // Pass 1: measure every block at column width, in the real fonts.
    flushSync(() => root.render(<RecipePdfMeasure header={header} blocks={blocks} />))
    // The serif title must be in Fraunces, not a fallback face, before measuring.
    await Promise.all([
      document.fonts.load('600 44px Fraunces'),
      document.fonts.load('600 24px Fraunces'),
      document.fonts.load('800 15px Nunito'),
      document.fonts.load('400 15px Nunito'),
    ]).catch(() => {})
    await document.fonts.ready
    const measure = host.firstElementChild
    const sheetTop = measure.getBoundingClientRect().top
    const firstTop = measure.querySelector('[data-pdf-body]').getBoundingClientRect().top - sheetTop
    const heights = [...measure.querySelectorAll('[data-pdf-block]')].map((el) => el.getBoundingClientRect().height)
    const layout = flowColumns(blocks, heights, firstTop)

    // Pass 2: the real pages, each block placed where the flow put it.
    flushSync(() => root.render(<RecipePdfPages header={header} blocks={blocks} pages={layout} />))
    const pageEls = [...host.querySelectorAll('[data-pdf-page]')]

    // 1 CSS px = 0.75pt, so an 816px-wide sheet is a true 8.5x11in page: text prints
    // and opens in Preview/Files at real size instead of shrunk to fit. Each page is
    // snapshotted on its own, so the canvas never grows past one page's pixels.
    const wPt = PAGE_WIDTH * 0.75
    const hPt = PAGE_HEIGHT * 0.75
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: [wPt, hPt], compress: true })
    const scale = Math.min(2, Math.sqrt(MAX_CANVAS_PIXELS / (PAGE_WIDTH * PAGE_HEIGHT)))
    const pages = []
    document.head.appendChild(probeFix)
    for (let p = 0; p < pageEls.length; p++) {
      const node = pageEls[p]
      const canvas = await html2canvas(node, {
        scale,
        backgroundColor: BG,
        logging: false,
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
        windowWidth: PAGE_WIDTH,
      })
      const photoEl = node.querySelector('[data-pdf-photo]')
      if (photo && photoEl) {
        const o = node.getBoundingClientRect()
        const r = photoEl.getBoundingClientRect()
        const box = { x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height }
        drawPhoto(canvas.getContext('2d'), photo.img, box, canvas.width / PAGE_WIDTH)
      }
      if (p) pdf.addPage([wPt, hPt], 'portrait')
      const jpeg = canvas.toDataURL('image/jpeg', 0.92)
      pdf.addImage(jpeg, 'JPEG', 0, 0, wPt, hPt, undefined, 'FAST')
      pages.push(jpeg)
      canvas.width = canvas.height = 0 // hand the pixels back now; iOS caps total canvas memory
    }
    pdf.setProperties({ title: recipe.title || 'Recipe' })
    const blob = pdf.output('blob')
    return { file: new File([blob], fileName(recipe.title), { type: 'application/pdf' }), pages }
  } finally {
    probeFix.remove()
    root.unmount()
    host.remove()
    photo?.release()
  }
}
