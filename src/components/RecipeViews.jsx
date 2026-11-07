import { primaryCategory } from '../lib/categories.js'
import { GridIcon, ListIcon, CategoryIcon, HeartIcon, PlusIcon } from './icons.jsx'
import SafeImage from './SafeImage.jsx'

// Shared with Pantry.jsx and Friends.jsx (FriendProfile) so both pages present
// the same grid/list preference instead of forking a second copy.
export const VIEW_KEY = 'pantry-view'

function totalTime(recipe) {
  const toMin = (t) => (t ? (t.unit === 'hr' ? t.value * 60 : t.value) : 0)
  const mins = toMin(recipe.prepTime) + toMin(recipe.cookTime)
  if (!mins) return null
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

// One look for every segmented toggle (grid/list, All/Favorites): a white pill
// holding buttons, the pressed one filled peach.
const TOGGLE_SHELL = 'flex shrink-0 items-center gap-1 rounded-2xl bg-white p-1 shadow-card'
const segment = (on) => `flex h-9 items-center justify-center rounded-xl transition ${
  on ? 'bg-peach text-warm' : 'text-warm-soft hover:bg-eggshell'
}`

export function ViewToggle({ view, onChange }) {
  const btn = (v, Icon, label) => (
    <button
      onClick={() => onChange(v)}
      aria-label={label}
      aria-pressed={view === v}
      className={`w-9 ${segment(view === v)}`}
    >
      <Icon className="h-5 w-5" />
    </button>
  )
  return (
    <div className={TOGGLE_SHELL}>
      {btn('grid', GridIcon, 'Grid view')}
      {btn('list', ListIcon, 'List view')}
    </div>
  )
}

// All of someone's recipes, or just the ones they've favorited (put in their own
// Pantry). Same shell and pressed style as ViewToggle, with words instead of icons.
export function FavoritesToggle({ value, onChange }) {
  const btn = (v, label) => (
    <button
      onClick={() => onChange(v)}
      aria-pressed={value === v}
      className={`px-3.5 text-sm font-bold ${segment(value === v)}`}
    >
      {label}
    </button>
  )
  return (
    <div className={TOGGLE_SHELL}>
      {btn('all', 'All')}
      {btn('favorites', 'Favorites')}
    </div>
  )
}

// showPocket mirrors RecipeCard's own prop: a friend's pantry list view needs the
// same one-tap "Copy to Pantry" grid view already gives it, since the recipe's own
// detail page has no pocket action -- without this, list view would be the only
// way to lose that capability.
export function RecipeListView({ recipes, isLiked, onOpen, showPocket = false, onPocket, pocketLabel = 'Copy to Pantry' }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-card">
      {/* Column header (hidden on the smallest screens) */}
      <div className="hidden items-center gap-3 border-b border-warm/10 px-4 py-2 text-xs font-bold uppercase tracking-wide text-warm-soft sm:flex">
        <span className="flex-1">Title</span>
        <span className="w-14 text-right">Time</span>
      </div>
      <ul className="divide-y divide-warm/10">
        {recipes.map((r) => {
          const time = totalTime(r)
          return (
            <li key={r.id}>
              <button
                onClick={() => onOpen(r.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-eggshell"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-peach/40 to-surface-2 text-peach-dark">
                  <SafeImage src={r.imageUrl} className="h-full w-full object-cover"
                      fallback={<CategoryIcon category={primaryCategory(r)} className="h-6 w-6" />} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 font-bold leading-snug">{r.title}</span>
                  <span className="block truncate text-xs text-warm-soft">
                    {r.pocketedFromName ? `Pocketed from ${r.pocketedFromName}` : `by ${r.authorName}`}
                  </span>
                </span>
                <span className="flex w-14 shrink-0 flex-col items-end gap-1">
                  {showPocket ? (
                    <span
                      onClick={(e) => { e.stopPropagation(); onPocket?.(r) }}
                      role="button"
                      aria-label={pocketLabel}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-peach text-warm transition active:scale-90"
                    >
                      <PlusIcon className="h-4 w-4" />
                    </span>
                  ) : (
                    <HeartIcon filled={isLiked(r.id)} className="h-4 w-4" emptyFill="#FAF4E8" emptyStroke="#F0EAD6" />
                  )}
                  <span className="text-xs font-semibold text-warm-soft">{time || '—'}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
