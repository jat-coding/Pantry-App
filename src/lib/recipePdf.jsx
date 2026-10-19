// Recipe -> Letter-size PDF, client-side: measure the recipe's blocks off-screen, flow
// them snake-wise through two columns per 8.5x11in page (flowColumns), render those
// pages, snapshot each with html2canvas, and add each to a jsPDF document (a long
// recipe flows onto more pages). No photo: the card is text only (2026-10-19).
// Loaded on demand (dynamic import from RecipeDetail) so jspdf/html2canvas stay out of
// the main bundle.
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { RecipePdfMeasure, RecipePdfPages, pdfBlocks, PDF_PAGE } from '../components/RecipePdfTemplate.jsx'

const PAGE_WIDTH = PDF_PAGE.width // CSS px = 8.5in at 96dpi -> 612pt PDF page width
const PAGE_HEIGHT = PDF_PAGE.height // CSS px = 11in at 96dpi -> 792pt
const PAGE_TOP = PDF_PAGE.top // top margin (page 1 has the header below it)
const PAGE_BOTTOM = PDF_PAGE.bottom // a column ends this far above the page's bottom edge
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
// (firstTop); later pages start at PAGE_TOP. Method always opens a fresh column (the
// one after wherever Ingredients ended), and a heading never sits alone at the
// bottom of a column without its first line. Returns pages[p] = [{ i, col, y }].
function gapBefore(prev, b) {
  if (b.type === 'heading') return 32
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

// "Source: allrecipes.com" for an imported recipe; nothing for one written here.
function sourceCredit(url) {
  try {
    return url ? `Source: ${new URL(url).hostname.replace(/^www\./, '')}` : ''
  } catch {
    return ''
  }
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
    flushSync(() => root.render(<RecipePdfMeasure header={header} blocks={blocks} />))
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
    const layout = flowColumns(blocks, heights, firstTop)

    // Pass 2: the real pages, each block placed where the flow put it.
    flushSync(() => root.render(<RecipePdfPages header={header} blocks={blocks} pages={layout} credit={sourceCredit(recipe.sourceUrl)} />))
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
  }
}
