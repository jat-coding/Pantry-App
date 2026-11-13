import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../contexts/DataContext.jsx'
import RecipeCard from '../components/RecipeCard.jsx'
import HelpModal from '../components/HelpModal.jsx'
import { CategoryFilter, SearchBar, matchesQuery, matchesCategories } from '../components/Filters.jsx'
import { CATEGORIES, primaryCategory } from '../lib/categories.js'
import { GridSkeleton } from '../components/Skeleton.jsx'
import { PantryIcon, CategoryIcon, HelpIcon } from '../components/icons.jsx'
import { ViewToggle, RecipeListView, VIEW_KEY } from '../components/RecipeViews.jsx'

const ONBOARDED_KEY = 'pantry-onboarded'
// Session-only, so opening a recipe and coming back keeps the sections you opened.
const EXPANDED_KEY = 'pantry-expanded'

const SORTS = { newest: 'Newest', az: 'A–Z', time: 'Cook time' }

// How many not-yet-liked recipes a category shows before its "See all" button.
const PREVIEW_COUNT = 4
// Recipes whose stored category isn't one of CATEGORIES (very old data) still
// need a home, so they land in this section after the real ones.
const OTHER = 'Other'

function totalMin(r) {
  const toMin = (t) => (t ? (t.unit === 'hr' ? t.value * 60 : t.value) : 0)
  return toMin(r.prepTime) + toMin(r.cookTime)
}

export default function Pantry() {
  const { recipes, pantryIds, loadingRecipes } = useData()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [cats, setCats] = useState([])
  const [sort, setSort] = useState('newest')
  const [view, setView] = useState(() => localStorage.getItem(VIEW_KEY) || 'grid')
  const [showHelp, setShowHelp] = useState(false)
  // Categories whose "See all" has been tapped.
  const [expanded, setExpanded] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(EXPANDED_KEY)) || [] } catch { return [] }
  })

  // Show the rundown automatically the first time someone opens the app.
  useEffect(() => {
    if (!localStorage.getItem(ONBOARDED_KEY)) {
      setShowHelp(true)
      localStorage.setItem(ONBOARDED_KEY, '1')
    }
  }, [])

  function setViewPersist(v) {
    setView(v)
    localStorage.setItem(VIEW_KEY, v)
  }

  function toggleCat(c) {
    setCats((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]))
  }

  function toggleExpanded(c) {
    setExpanded((s) => {
      const next = s.includes(c) ? s.filter((x) => x !== c) : [...s, c]
      sessionStorage.setItem(EXPANDED_KEY, JSON.stringify(next))
      return next
    })
  }

  const filtered = useMemo(() => {
    const list = recipes.filter(
      (r) => matchesCategories(r, cats) && matchesQuery(r, query),
    )
    const sorted = [...list]
    if (sort === 'az') sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    else if (sort === 'time') sorted.sort((a, b) => totalMin(a) - totalMin(b))
    else sorted.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    return sorted
  }, [recipes, query, cats, sort])

  // One section per category, in CATEGORIES order. Each recipe goes in its
  // primary category only, so a Snacks + Lunch recipe never shows up twice.
  // Liked recipes lead each section; both halves keep the chosen sort.
  const likedIds = useMemo(() => new Set(pantryIds), [pantryIds])
  const isLiked = (id) => likedIds.has(id)
  const sections = useMemo(() => {
    const order = [...CATEGORIES, OTHER]
    const byCat = new Map(order.map((c) => [c, { liked: [], rest: [] }]))
    for (const r of filtered) {
      const p = primaryCategory(r)
      const bucket = byCat.get(CATEGORIES.includes(p) ? p : OTHER)
      ;(likedIds.has(r.id) ? bucket.liked : bucket.rest).push(r)
    }
    let list = [...byCat]
      .filter(([, b]) => b.liked.length + b.rest.length > 0)
      .map(([category, b]) => ({ category, ...b }))
    // A selected category can still pull in recipes whose *primary* section sits
    // earlier in CATEGORIES (e.g. a Lunch recipe also tagged Dinner, matching a
    // Dinner filter). Showing that earlier section reads as the filter doing
    // nothing, so once something's selected we cut everything above the
    // earliest selected category and keep the selected section plus whatever
    // falls after it, in their existing order.
    if (cats.length) {
      const minIndex = Math.min(...cats.map((c) => order.indexOf(c)))
      list = list.filter(({ category }) => order.indexOf(category) >= minIndex)
    }
    return list
  }, [filtered, likedIds, cats])

  // While searching, show every match instead of hiding some behind "See all".
  const searching = query.trim() !== ''
  const openRecipe = (id) => navigate(`/recipe/${id}`, { state: { from: '/' } })

  return (
    <div className="animate-fadein space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">My Pantry</h1>
        </div>
        <button
          onClick={() => setShowHelp(true)}
          aria-label="How to use Pantry"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-zinc-800 shadow-card transition active:scale-90 hover:bg-eggshell"
        >
          <HelpIcon className="h-6 w-6" />
        </button>
      </header>

      <SearchBar value={query} onChange={setQuery} />

      {/* View toggle + sort — its own small section right above the categories */}
      <div className="flex items-center justify-between gap-3">
        <ViewToggle view={view} onChange={setViewPersist} />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          aria-label="Sort recipes"
          className="rounded-2xl border border-warm/15 bg-white px-3 py-2 text-sm font-bold outline-none"
        >
          {Object.entries(SORTS).map(([k, v]) => (
            <option key={k} value={k}>Sort: {v}</option>
          ))}
        </select>
      </div>

      <CategoryFilter selected={cats} onToggle={toggleCat} onClear={() => setCats([])} />

      {loadingRecipes ? (
        <GridSkeleton />
      ) : recipes.length === 0 ? (
        <EmptyState onCreate={() => navigate('/new')} />
      ) : sections.length === 0 ? (
        <p className="py-16 text-center text-warm-soft">No recipes match your search.</p>
      ) : (
        <div className="space-y-8">
          {sections.map(({ category, liked, rest }) => {
            const open = searching || expanded.includes(category)
            const shownRest = open ? rest : rest.slice(0, PREVIEW_COUNT)
            const hidden = rest.length - PREVIEW_COUNT
            const shown = [...liked, ...shownRest]
            return (
              <section key={category} data-category={category} className="space-y-3">
                <h2 className="flex items-center gap-2 text-xl font-extrabold">
                  <CategoryIcon category={category} className="h-5 w-5 text-zinc-800" />
                  {category}
                  <span className="text-sm font-bold text-warm-soft">{liked.length + rest.length}</span>
                </h2>
                {view === 'list' ? (
                  <RecipeListView recipes={shown} isLiked={isLiked} onOpen={openRecipe} />
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {shown.map((r) => (
                      <RecipeCard key={r.id} recipe={r} />
                    ))}
                  </div>
                )}
                {!searching && hidden > 0 && (
                  <button
                    onClick={() => toggleExpanded(category)}
                    aria-expanded={open}
                    className="w-full rounded-2xl border border-warm/15 bg-white py-2.5 text-sm font-bold text-warm shadow-card transition active:scale-[.98] hover:bg-eggshell"
                  >
                    {open ? 'Show fewer' : `See all ${category} (${hidden} more)`}
                  </button>
                )}
              </section>
            )
          })}
        </div>
      )}

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  )
}

function EmptyState({ onCreate }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
      <PantryIcon className="h-16 w-16 text-zinc-800" />
      <h2 className="text-xl font-extrabold">Your pantry is empty</h2>
      <p className="max-w-xs text-warm-soft">
        Import a recipe from a link with the + button, or write one yourself. Hearted recipes show first in their category.
      </p>
      <button className="btn-peach mt-2" onClick={onCreate}>
        Write a recipe
      </button>
    </div>
  )
}
