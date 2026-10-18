// Printable recipe card, laid out after the "Honey Garlic Glazed Salmon" card Mr. Roni
// sent: eyebrow label with sprigs, serif title, a slim stat banner, then the body as
// ONE read order (photo, Ingredients, Method) snaked through two equal columns per
// page: down the left column, then the right, then the next page's left, and so on.
// Only ever rendered off-screen by lib/recipePdf.jsx and snapshotted into a PDF --
// never shown in the UI. Fixed pixel sizes on purpose: each page is a fixed 816x1056px
// (8.5x11in @ 96dpi) sheet.
// Two passes: <RecipePdfMeasure> stacks every body block in a single column so
// lib/recipePdf.jsx can read their real heights, decide which column each lands in
// (flowColumns there), and then <RecipePdfPages> draws the finished pages with each
// block absolutely placed. Doing the flow in JS instead of CSS multi-column keeps
// html2canvas on plain absolutely positioned boxes, which it draws reliably.
// html2canvas quirks this works around: icons get an explicit `color` (an SVG is
// rasterised standalone, so currentColor would come out black) and the photo is not
// drawn here at all: this only reserves its rounded box (data-pdf-photo), and
// lib/recipePdf.jsx paints the cover-cropped photo into that box itself after the
// snapshot, so html2canvas never has to load or crop it.
import { Users, Timer, CookingPot, UtensilsCrossed, Sprout } from 'lucide-react'

const ROSE = '#B9837A' // dusty-rose accent from the reference card

export const PDF_PAGE = { width: 816, height: 1056, side: 56, top: 48, bottom: 56 }
export const PDF_COL_GAP = 40
export const PDF_COL_WIDTH = (PDF_PAGE.width - 2 * PDF_PAGE.side - PDF_COL_GAP) / 2 // 332

function Sprig({ flip }) {
  return <Sprout className="h-5 w-5" color={ROSE} style={{ transform: flip ? 'scaleX(-1)' : undefined }} strokeWidth={1.5} />
}

function Stat({ icon: Icon, label, value }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <Icon className="h-3.5 w-3.5" color={ROSE} strokeWidth={2} />
      <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-warm">{label}</span>
      <span className="text-[13px] font-semibold text-warm-soft">{value}</span>
    </span>
  )
}

function Header({ eyebrow, title, servings, prep, cook, total }) {
  return (
    <div>
      <div className="flex items-center justify-center gap-3">
        <Sprig flip />
        <span className="text-[13px] font-bold uppercase tracking-[0.35em] text-warm-soft">{eyebrow}</span>
        <Sprig />
      </div>
      <h1 className="mt-3 text-center font-display text-[44px] font-semibold uppercase leading-[1.08] text-warm">
        {title}
      </h1>
      {/* Stat banner: one thin line, all four values */}
      <div className="mt-5 flex items-center justify-center gap-7 border-y border-warm/25 py-2">
        <Stat icon={Users} label="Serves" value={servings} />
        <Stat icon={Timer} label="Prep" value={prep} />
        <Stat icon={CookingPot} label="Cook" value={cook} />
        <Stat icon={UtensilsCrossed} label="Total" value={total} />
      </div>
    </div>
  )
}

// The body in read order. Each entry is one unbreakable block.
export function pdfBlocks({ ingredients, steps, hasPhoto }) {
  return [
    ...(hasPhoto ? [{ type: 'photo' }] : []),
    { type: 'heading', text: 'Ingredients' },
    ...ingredients.map((text) => ({ type: 'ingredient', text })),
    { type: 'heading', text: 'Method', section: true },
    ...steps.map((text, i) => ({ type: 'step', text, n: i + 1 })),
  ]
}

function Block({ block }) {
  if (block.type === 'photo') return <div data-pdf-photo className="h-[300px] w-full rounded-[28px]" />
  if (block.type === 'heading') {
    return <h2 className="text-[15px] font-extrabold uppercase leading-[1.3] tracking-[0.18em] text-warm">{block.text}</h2>
  }
  if (block.type === 'ingredient') {
    return (
      <div className="flex gap-2 text-[15px] leading-snug">
        <span className="shrink-0">&bull;</span>
        <span>{block.text}</span>
      </div>
    )
  }
  return (
    <div className="flex gap-3">
      <span className="w-9 shrink-0 font-display text-[24px] font-semibold leading-none" style={{ color: ROSE }}>
        {String(block.n).padStart(2, '0')}
      </span>
      <span className="text-[15px] leading-snug">{block.text}</span>
    </div>
  )
}

const sheet = 'relative bg-surface-2 font-sans text-warm'
const pad = { paddingLeft: PDF_PAGE.side, paddingRight: PDF_PAGE.side, paddingTop: PDF_PAGE.top }

// Pass 1: the page-1 header, then every block stacked in one column-wide strip.
// data-pdf-body marks where the columns start on page 1.
export function RecipePdfMeasure({ header, blocks }) {
  return (
    <div className={sheet} style={{ ...pad, width: PDF_PAGE.width }}>
      <Header {...header} />
      <div data-pdf-body className="mt-7" style={{ width: PDF_COL_WIDTH }}>
        {blocks.map((b, i) => (
          <div key={i} data-pdf-block>
            <Block block={b} />
          </div>
        ))}
      </div>
    </div>
  )
}

// Pass 2: pages[p] = [{ i, col, y }] -- block i in column col (0 left, 1 right) at y
// CSS px from the page's top edge.
export function RecipePdfPages({ header, blocks, pages }) {
  return (
    <div>
      {pages.map((placed, p) => (
        <div
          key={p}
          data-pdf-page
          className={`${sheet} overflow-hidden`}
          style={{ ...pad, width: PDF_PAGE.width, height: PDF_PAGE.height }}
        >
          {p === 0 && <Header {...header} />}
          {placed.map(({ i, col, y }) => (
            <div
              key={i}
              className="absolute"
              style={{ top: y, left: PDF_PAGE.side + col * (PDF_COL_WIDTH + PDF_COL_GAP), width: PDF_COL_WIDTH }}
            >
              <Block block={blocks[i]} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
