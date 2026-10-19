// Recipe -> PDF, client-side, at one of two paper sizes (PDF_SIZES): a full 8.5x11in
// page (the default) or a 6x4in index card. Measure the recipe's blocks off-screen,
// flow them snake-wise through two columns per page (flowColumns), render those
// pages, snapshot each with html2canvas, and add each to a jsPDF document (a long
// recipe flows onto more pages / more cards). No photo: the card is text only
// (2026-10-19).
// Loaded on demand (dynamic import from RecipeDetail) so jspdf/html2canvas stay out of
// the main bundle.
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { RecipePdfMeasure, RecipePdfPages, pdfBlocks, PDF_SIZES } from '../components/RecipePdfTemplate.jsx'

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

// The snake flow. Blocks go down the left column, then the right, then the next
// page's left, and so on, never split. Page 1's columns start under the header
// (firstTop); later pages start at the size's top margin. Method always opens a fresh column (the
// one after wherever Ingredients ended), and a heading never sits alone at the
// bottom of a column without its first line. Returns pages[p] = [{ i, col, y }].
function gapBefore(prev, b, gaps) {
  if (b.type === 'heading') return gaps.heading
  if (prev.type === 'heading') return gaps.afterHeading
  return b.type === 'step' ? gaps.step : gaps.ingredient
}

export function flowColumns(blocks, heights, firstTop, size = PDF_SIZES.page) {
  const { gaps } = size
  const bottom = size.height - size.bottom // a column ends this far above the page's bottom edge
  const pages = [[]]
  let col = 0
  let y = firstTop
  let empty = true
  let prev = null
  const nextColumn = () => {
    if (++col === 2) { col = 0; pages.push([]) }
    y = pages.length > 1 ? size.top : firstTop
    empty = true
  }
  blocks.forEach((b, i) => {
    if (b.section && !empty) nextColumn()
    let gap = empty ? 0 : gapBefore(prev, b, gaps)
    let need = gap + heights[i]
    if (b.type === 'heading' && i + 1 < blocks.length) need += gapBefore(b, blocks[i + 1], gaps) + heights[i + 1]
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

// "Source: allrecipes.com" for an imported recipe; nothing for one written here.
function sourceCredit(url) {
  try {
    return url ? `Source: ${new URL(url).hostname.replace(/^www\./, '')}` : ''
  } catch {
    return ''
  }
}

function fileName(title, sizeName) {
  const slug = (title || 'recipe').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${slug || 'recipe'}${sizeName === 'card' ? '-card' : ''}.pdf`
}

// recipe: the recipe as shown. ingredients: display lines in the reader's current
// scaled view (amount + unit + name). servings: the scaled servings label.
// size: 'page' (8.5x11in, the default) or 'card' (6x4in index card).
// Returns the PDF file plus each page as the JPEG data URL that went into it, so the
// in-app preview shows exactly what gets shared (iOS can't scroll a PDF in a page).
export async function buildRecipePdf({ recipe, ingredients, servings, size: sizeName = 'page' }) {
  const size = PDF_SIZES[sizeName] || PDF_SIZES.page
  const { width: PAGE_WIDTH, height: PAGE_HEIGHT } = size // CSS px at 96dpi
  const prep = minutes(recipe.prepTime)
  const cook = minutes(recipe.cookTime)

  const steps = recipe.instructions.filter((st) => st && st.trim())
  const blocks = pdfBlocks({ ingredients, steps })
  const header = {
    title: recipe.title,
    servings,
    prep: timeText(prep),
    cook: timeText(cook),
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
    flushSync(() => root.render(<RecipePdfMeasure header={header} blocks={blocks} size={size} />))
    // The serif title must be in Fraunces, not a fallback face, before measuring.
    await Promise.all([
      document.fonts.load('600 34px Fraunces'),
      document.fonts.load('600 20px Fraunces'),
      document.fonts.load('800 15px Nunito'),
      document.fonts.load('400 15px Nunito'),
    ]).catch(() => {})
    await document.fonts.ready
    const measure = host.firstElementChild
    const sheetTop = measure.getBoundingClientRect().top
    const firstTop = measure.querySelector('[data-pdf-body]').getBoundingClientRect().top - sheetTop
    const heights = [...measure.querySelectorAll('[data-pdf-block]')].map((el) => el.getBoundingClientRect().height)
    const layout = flowColumns(blocks, heights, firstTop, size)

    // Pass 2: the real pages, each block placed where the flow put it.
    flushSync(() => root.render(<RecipePdfPages header={header} blocks={blocks} pages={layout} credit={sourceCredit(recipe.sourceUrl)} size={size} />))
    const pageEls = [...host.querySelectorAll('[data-pdf-page]')]

    // 1 CSS px = 0.75pt, so an 816px-wide sheet is a true 8.5x11in page (and a
    // 576px card a true 6x4in card): text prints and opens in Preview/Files at real
    // size instead of shrunk to fit. Each page is snapshotted on its own, so the canvas
    // never grows past one page's pixels. The card is snapshotted at 3x (288dpi) so its
    // small type stays crisp in print; the full page keeps its 2x.
    const wPt = PAGE_WIDTH * 0.75
    const hPt = PAGE_HEIGHT * 0.75
    const orientation = wPt > hPt ? 'landscape' : 'portrait' // jsPDF swaps w/h to match this
    const pdf = new jsPDF({ orientation, unit: 'pt', format: [wPt, hPt], compress: true })
    const scale = Math.min(sizeName === 'card' ? 3 : 2, Math.sqrt(MAX_CANVAS_PIXELS / (PAGE_WIDTH * PAGE_HEIGHT)))
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
      if (p) pdf.addPage([wPt, hPt], orientation)
      const jpeg = canvas.toDataURL('image/jpeg', 0.92)
      pdf.addImage(jpeg, 'JPEG', 0, 0, wPt, hPt, undefined, 'FAST')
      pages.push(jpeg)
      canvas.width = canvas.height = 0 // hand the pixels back now; iOS caps total canvas memory
    }
    pdf.setProperties({ title: recipe.title || 'Recipe' })
    const blob = pdf.output('blob')
    return { file: new File([blob], fileName(recipe.title, sizeName), { type: 'application/pdf' }), pages, aspect: `${PAGE_WIDTH} / ${PAGE_HEIGHT}` }
  } finally {
    probeFix.remove()
    root.unmount()
    host.remove()
  }
}
