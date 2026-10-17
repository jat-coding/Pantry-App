// Printable recipe card, laid out after the "Honey Garlic Glazed Salmon" card Mr. Roni
// sent: eyebrow label with sprigs, serif title, 4-stat row, ingredients | numbered
// method, ornament divider, boxed note, photo bottom-right. Only ever rendered
// off-screen by lib/recipePdf.js and snapshotted into a PDF -- never shown in the UI.
// Fixed pixel sizes on purpose: the page is a fixed 816px (8.5in @ 96dpi) sheet.
// html2canvas quirks this works around: icons get an explicit `color` (an SVG is
// rasterised standalone, so currentColor would come out black) and the photo is a
// cover-sized background, since html2canvas ignores object-fit on <img>.
import { Users, Timer, CookingPot, UtensilsCrossed, Sprout, ChefHat } from 'lucide-react'

const ROSE = '#B9837A' // dusty-rose accent from the reference card

function Sprig({ flip }) {
  return <Sprout className="h-5 w-5" color={ROSE} style={{ transform: flip ? 'scaleX(-1)' : undefined }} strokeWidth={1.5} />
}

function StatCell({ icon: Icon, label, value, last }) {
  return (
    <div className={`flex flex-1 flex-col items-center gap-1.5 py-4 ${last ? '' : 'border-r border-warm/20'}`}>
      <span className="flex h-11 w-11 items-center justify-center rounded-full text-white" style={{ background: ROSE }}>
        <Icon className="h-5 w-5" color="#fff" strokeWidth={1.8} />
      </span>
      <span className="text-[13px] font-extrabold uppercase tracking-[0.12em] text-warm">{label}</span>
      <span className="text-[14px] font-semibold uppercase text-warm-soft">{value}</span>
    </div>
  )
}

function Heading({ children }) {
  return <h2 className="mb-3 text-[15px] font-extrabold uppercase tracking-[0.18em] text-warm">{children}</h2>
}

// recipe: the (sanitized) recipe. ingredients: display strings, already scaled and
// in the reader's chosen units. servings: scaled servings label. imageSrc: a
// same-origin data URL (or null to skip the photo entirely).
export default function RecipePdfTemplate({ recipe, eyebrow, ingredients, servings, prep, cook, total, note, imageSrc }) {
  const steps = recipe.instructions.filter((s) => s && s.trim())
  return (
    <div className="w-[816px] bg-surface-2 px-14 pb-14 pt-12 font-sans text-warm" style={{ minHeight: 1056 }}>
      {/* Eyebrow + title */}
      <div className="flex items-center justify-center gap-3">
        <Sprig flip />
        <span className="text-[13px] font-bold uppercase tracking-[0.35em] text-warm-soft">{eyebrow}</span>
        <Sprig />
      </div>
      <h1 className="mt-3 text-center font-display text-[44px] font-semibold uppercase leading-[1.08] text-warm">
        {recipe.title}
      </h1>

      {/* Stat row */}
      <div className="mt-6 flex border-y border-warm/25">
        <StatCell icon={Users} label="Serves" value={servings} />
        <StatCell icon={Timer} label="Prep" value={prep} />
        <StatCell icon={CookingPot} label="Cook" value={cook} />
        <StatCell icon={UtensilsCrossed} label="Total" value={total} last />
      </div>

      {/* Body */}
      <div className="mt-8 grid grid-cols-[5fr_7fr] gap-10">
        <div>
          <Heading>Ingredients</Heading>
          <ul className="space-y-1.5 text-[15px] leading-snug">
            {ingredients.map((line, i) => (
              <li key={i} className="flex gap-2">
                <span className="shrink-0">&bull;</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>

          {note && (
            <>
              <div className="my-7 flex items-center gap-3">
                <span className="h-px flex-1 bg-warm/25" />
                <Sprout className="h-4 w-4" color={ROSE} strokeWidth={1.5} />
                <span className="h-px flex-1 bg-warm/25" />
              </div>
              <div className="relative mt-10 border px-5 pb-5 pt-9 text-center" style={{ borderColor: ROSE }}>
                <span className="absolute -top-6 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: ROSE, left: 'calc(50% - 24px)' }}>
                  <ChefHat className="h-6 w-6" color="#fff" strokeWidth={1.6} />
                </span>
                <div className="text-[14px] font-extrabold uppercase tracking-[0.16em]">{note.title}</div>
                <p className="mt-2 text-[14px] leading-snug text-warm-soft">{note.body}</p>
              </div>
            </>
          )}
        </div>

        <div>
          <Heading>Method</Heading>
          <ol className="space-y-3">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-9 shrink-0 font-display text-[24px] font-semibold leading-none" style={{ color: ROSE }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-[15px] leading-snug">{step}</span>
              </li>
            ))}
          </ol>

          {imageSrc && (
            <div className="mt-8 h-[300px] w-full rounded-[28px] bg-cover bg-center" style={{ backgroundImage: `url("${imageSrc}")` }} />
          )}
        </div>
      </div>
    </div>
  )
}
