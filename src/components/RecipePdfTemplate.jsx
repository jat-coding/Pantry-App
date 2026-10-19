// Printable recipe card in an index-card style: serif title, one slim stat line
// (Serves / Prep / Cook), a dusty-rose rule like a ruled card's header line, then the
// body as ONE read order (Ingredients, Method) snaked through two equal
// columns per page: down the left column, then the right, then the next page's left,
// and so on, plus a small source credit in the last page's bottom margin. No photo:
// it's a card to cook from, not a picture of the dish.
// Only ever rendered off-screen by lib/recipePdf.jsx and snapshotted into a PDF --
// never shown in the UI. Fixed pixel sizes on purpose, one set per paper size in
// PDF_SIZES: a full page is a fixed 816x1056px (8.5x11in @ 96dpi) sheet, an index
// card a 576x384px (6x4in) card with the same layout at card-sized type.
// Two passes: <RecipePdfMeasure> stacks every body block in a single column so
// lib/recipePdf.jsx can read their real heights, decide which column each lands in
// (flowColumns there), and then <RecipePdfPages> draws the finished pages with each
// block absolutely placed. Doing the flow in JS instead of CSS multi-column keeps
// html2canvas on plain absolutely positioned boxes, which it draws reliably.
// html2canvas quirk this works around: icons get an explicit `color` (an SVG is
// rasterised standalone, so currentColor would come out black).
import { Users, Timer, CookingPot } from 'lucide-react'

const ROSE = '#B9837A' // dusty-rose accent from the reference card

// Every size-dependent number and type size, per paper size. `page` is the original
// Letter sheet and must stay exactly as it was; `card` is a standard 4x6in recipe
// card, held landscape (6in wide) like a real one. A 3x5 card would just be
// width 480 x height 288 here plus a smaller type scale.
// gaps: space above a block, see gapBefore in lib/recipePdf.jsx.
export const PDF_SIZES = {
  page: {
    width: 816, height: 1056, side: 56, top: 48, bottom: 56, colGap: 40, creditBottom: 24,
    gaps: { heading: 32, afterHeading: 12, step: 12, ingredient: 6 },
    type: {
      title: 'text-[34px] leading-[1.1]', stats: 'mt-2 gap-6', stat: 'gap-1.5', icon: 'h-3.5 w-3.5',
      statLabel: 'text-[11px] tracking-[0.14em]', statValue: 'text-[13px]', rule: 'mt-3 h-[2px]', body: 'mt-6',
      heading: 'text-[15px] tracking-[0.18em]', ingredient: 'gap-2 text-[15px]', step: 'gap-3',
      stepNum: 'w-7 text-[20px]', stepText: 'text-[15px]', credit: 'text-[13px]',
    },
  },
  card: {
    width: 576, height: 384, side: 24, top: 20, bottom: 26, colGap: 20, creditBottom: 10,
    gaps: { heading: 14, afterHeading: 6, step: 6, ingredient: 3 },
    type: {
      title: 'text-[20px] leading-[1.15]', stats: 'mt-1 gap-4', stat: 'gap-1', icon: 'h-2.5 w-2.5',
      statLabel: 'text-[8px] tracking-[0.12em]', statValue: 'text-[10px]', rule: 'mt-2 h-[1.5px]', body: 'mt-3',
      heading: 'text-[10px] tracking-[0.16em]', ingredient: 'gap-1.5 text-[11px]', step: 'gap-2',
      stepNum: 'w-5 text-[14px]', stepText: 'text-[11px]', credit: 'text-[9px]',
    },
  },
}
for (const z of Object.values(PDF_SIZES)) z.colWidth = (z.width - 2 * z.side - z.colGap) / 2 // page: 332, card: 254

function Stat({ icon: Icon, label, value, t }) {
  return (
    <span className={`flex items-center ${t.stat} whitespace-nowrap`}>
      <Icon className={t.icon} color={ROSE} strokeWidth={2} />
      <span className={`${t.statLabel} font-extrabold uppercase text-warm`}>{label}</span>
      <span className={`${t.statValue} font-semibold text-warm-soft`}>{value}</span>
    </span>
  )
}

function Header({ title, servings, prep, cook, t }) {
  return (
    <div>
      <h1 className={`font-display ${t.title} font-semibold text-warm`}>{title}</h1>
      <div className={`${t.stats} flex items-center`}>
        <Stat icon={Users} label="Serves" value={servings} t={t} />
        <Stat icon={Timer} label="Prep" value={prep} t={t} />
        <Stat icon={CookingPot} label="Cook" value={cook} t={t} />
      </div>
      {/* The card's ruled header line */}
      <div className={`${t.rule} w-full`} style={{ background: ROSE }} />
    </div>
  )
}

// The body in read order. Each entry is one unbreakable block.
export function pdfBlocks({ ingredients, steps }) {
  return [
    { type: 'heading', text: 'Ingredients' },
    ...ingredients.map((text) => ({ type: 'ingredient', text })),
    { type: 'heading', text: 'Method', section: true },
    ...steps.map((text, i) => ({ type: 'step', text, n: i + 1 })),
  ]
}

function Block({ block, t }) {
  if (block.type === 'heading') {
    return <h2 className={`${t.heading} font-extrabold uppercase leading-[1.3] text-warm`}>{block.text}</h2>
  }
  if (block.type === 'ingredient') {
    return (
      <div className={`flex ${t.ingredient} leading-snug`}>
        <span className="shrink-0">&bull;</span>
        <span>{block.text}</span>
      </div>
    )
  }
  return (
    <div className={`flex ${t.step}`}>
      <span className={`${t.stepNum} shrink-0 font-display font-semibold leading-none`} style={{ color: ROSE }}>
        {String(block.n).padStart(2, '0')}
      </span>
      <span className={`${t.stepText} leading-snug`}>{block.text}</span>
    </div>
  )
}

const sheet = 'relative bg-surface-2 font-sans text-warm'
const pad = (z) => ({ paddingLeft: z.side, paddingRight: z.side, paddingTop: z.top })

// Pass 1: the page-1 header, then every block stacked in one column-wide strip.
// data-pdf-body marks where the columns start on page 1. size: a PDF_SIZES entry.
export function RecipePdfMeasure({ header, blocks, size: z }) {
  return (
    <div className={sheet} style={{ ...pad(z), width: z.width }}>
      <Header {...header} t={z.type} />
      <div data-pdf-body className={z.type.body} style={{ width: z.colWidth }}>
        {blocks.map((b, i) => (
          <div key={i} data-pdf-block>
            <Block block={b} t={z.type} />
          </div>
        ))}
      </div>
    </div>
  )
}

// Pass 2: pages[p] = [{ i, col, y }] -- block i in column col (0 left, 1 right) at y
// CSS px from the page's top edge. credit: "Source: site.com" or '' -- drawn in the
// last page's bottom margin (outside the columns, so it never costs a page).
export function RecipePdfPages({ header, blocks, pages, credit, size: z }) {
  return (
    <div>
      {pages.map((placed, p) => (
        <div
          key={p}
          data-pdf-page
          className={`${sheet} overflow-hidden`}
          style={{ ...pad(z), width: z.width, height: z.height }}
        >
          {p === 0 && <Header {...header} t={z.type} />}
          {placed.map(({ i, col, y }) => (
            <div
              key={i}
              className="absolute"
              style={{ top: y, left: z.side + col * (z.colWidth + z.colGap), width: z.colWidth }}
            >
              <Block block={blocks[i]} t={z.type} />
            </div>
          ))}
          {credit && p === pages.length - 1 && (
            <p className={`absolute ${z.type.credit} italic leading-none text-warm-soft`} style={{ left: z.side, bottom: z.creditBottom }}>
              {credit}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
