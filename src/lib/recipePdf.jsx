// Recipe -> one-page PDF, client-side: render RecipePdfTemplate off-screen, snapshot it
// with html2canvas, wrap the bitmap in a PDF page sized to it with jsPDF.
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

// The photo's bytes as a data URL, so the canvas is never tainted. Snapshotted
// photos live in Firebase Storage, which sends `access-control-allow-origin: *`, so a
// plain fetch works. A photo still on its original site is read through our own
// /api/image-fetch (the same proxy the snapshotter uses). Any failure -> null, and
// the PDF is drawn without a photo rather than with a broken box.
async function loadPhoto(url) {
  if (!url) return null
  const sources = isExternalImage(url) ? [`/api/image-fetch?url=${encodeURIComponent(url)}`] : [url]
  for (const src of sources) {
    try {
      const resp = await withTimeout(fetch(src, { referrerPolicy: 'no-referrer' }), 15000, 'photo timed out')
      if (!resp.ok) continue
      const blob = await resp.blob()
      if (!blob.type.startsWith('image/')) continue
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(r.result)
        r.onerror = () => reject(r.error)
        r.readAsDataURL(blob)
      })
      // Wait until it has actually decoded -- an undecodable image is skipped too.
      const img = new Image()
      img.src = dataUrl
      await withTimeout(img.decode(), 10000, 'photo decode timed out')
      return dataUrl
    } catch { /* try the next source, else no photo */ }
  }
  return null
}

function fileName(title) {
  const slug = (title || 'recipe').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${slug || 'recipe'}.pdf`
}

// recipe: the recipe as shown. ingredients: display lines in the reader's current
// scaled view (amount + unit + name). servings: the scaled servings label.
export async function buildRecipePdf({ recipe, ingredients, servings }) {
  const imageSrc = await loadPhoto(recipe.imageUrl)
  const prep = minutes(recipe.prepTime)
  const cook = minutes(recipe.cookTime)
  const note = recipe.pocketedFromName
    ? { title: 'Pocketed From', body: `Saved from ${recipe.pocketedFromName}’s recipe collection.` }
    : recipe.authorName
      ? { title: 'From the Kitchen Of', body: recipe.authorName }
      : null

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
          note={note}
          imageSrc={imageSrc}
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
    const scale = Math.min(2, Math.sqrt(MAX_CANVAS_PIXELS / (w * h)))
    const canvas = await html2canvas(node, {
      scale,
      backgroundColor: '#FAF4E8',
      logging: false,
      width: w,
      height: h,
      windowWidth: PAGE_WIDTH,
    })

    // 1 CSS px = 0.75pt, so an 816px-wide sheet is a true 8.5in page: text prints and
    // opens in Preview/Files at real size instead of shrunk to fit.
    const wPt = w * 0.75
    const hPt = h * 0.75
    const pdf = new jsPDF({ orientation: hPt >= wPt ? 'portrait' : 'landscape', unit: 'pt', format: [wPt, hPt], compress: true })
    pdf.addImage(canvas, 'JPEG', 0, 0, wPt, hPt, undefined, 'FAST')
    pdf.setProperties({ title: recipe.title || 'Recipe' })
    const blob = pdf.output('blob')
    return new File([blob], fileName(recipe.title), { type: 'application/pdf' })
  } finally {
    root.unmount()
    host.remove()
  }
}
