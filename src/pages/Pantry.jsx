import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../contexts/DataContext.jsx'
import RecipeCard from '../components/RecipeCard.jsx'
import HelpModal from '../components/HelpModal.jsx'
import { CategoryFilter, SearchBar, matchesQuery, matchesCategories } from '../components/Filters.jsx'
import { getCategories, primaryCategory } from '../lib/categories.js'
import { GridSkeleton } from '../components/Skeleton.jsx'
import { GridIcon, ListIcon, PantryIcon, CategoryIcon, HelpIcon } from '../components/icons.jsx'
import SafeImage from '../components/SafeImage.jsx'

const VIEW_KEY = 'pantry-view'
const ONBOARDED_KEY = 'pantry-onboarded'

const SORTS = { newest: 'Newest', az: 'A–Z', time: 'Cook time' }

function totalMin(r) {
  const toMin = (t) => (t ? (t.unit === 'hr' ? t.value * 60 : t.value) : 0)
  return toMin(r.prepTime) + toMin(r.cookTime)
}

function totalTime(recipe) {
  const mins = totalMin(recipe)
  if (!mins) return null
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export default function Pantry() {
  const { pantryRecipes, loadingRecipes } = useData()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [cats, setCats] = useState([])
  const [sort, setSort] = useState('newest')
  const [view, setView] = useState(() => localStorage.getItem(VIEW_KEY) || 'grid')
  const [showHelp, setShowHelp] = useState(false)

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

  const filtered = useMemo(() => {
    const list = pantryRecipes.filter(
      (r) => matchesCategories(r, cats) && matchesQuery(r, query),
    )
    const sorted = [...list]
    if (sort === 'az') sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    else if (sort === 'time') sorted.sort((a, b) => totalMin(a) - totalMin(b))
    else sorted.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    return sorted
  }, [pantryRecipes, query, cats, sort])

  return (
    <div className="animate-fadein space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">My Pantry</h1>
          <p className="text-warm-soft">The recipes you love, all in one place.</p>
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
      ) : pantryRecipes.length === 0 ? (
        <EmptyState onBrowse={() => navigate('/recipes')} />
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-warm-soft">No recipes match your search.</p>
      ) : view === 'list' ? (
        <RecipeListView recipes={filtered} onOpen={(id) => navigate(`/recipe/${id}`, { state: { from: '/' } })} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <RecipeCard key={r.id} recipe={r} />
          ))}
        </div>
      )}

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  )
}

function ViewToggle({ view, onChange }) {
  const btn = (v, Icon, label) => (
    <button
      onClick={() => onChange(v)}
      aria-label={label}
      aria-pressed={view === v}
      className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
        view === v ? 'bg-peach text-warm' : 'text-warm-soft hover:bg-eggshell'
      }`}
    >
      <Icon className="h-5 w-5" />
    </button>
  )
  return (
    <div className="flex shrink-0 items-center gap-1 rounded-2xl bg-white p-1 shadow-card">
      {btn('grid', GridIcon, 'Grid view')}
      {btn('list', ListIcon, 'List view')}
    </div>
  )
}

function RecipeListView({ recipes, onOpen }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-card">
      {/* Column header (hidden on the smallest screens) */}
      <div className="hidden items-center gap-3 border-b border-warm/10 px-4 py-2 text-xs font-bold uppercase tracking-wide text-warm-soft sm:flex">
        <span className="flex-1">Title</span>
        <span className="w-20 text-right">Time</span>
        <span className="w-24 text-right">Category</span>
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
                  <span className="block truncate font-bold">{r.title}</span>
                  <span className="block truncate text-xs text-warm-soft">
                    {r.pocketedFromName ? `Pocketed from ${r.pocketedFromName}` : `by ${r.authorName}`}
                  </span>
                </span>
                <span className="w-20 text-right text-xs font-semibold text-warm-soft">
                  {time || '—'}
                </span>
                <span className="flex w-24 flex-wrap justify-end gap-1">
                  {getCategories(r).map((c) => <span key={c} className="pill-peach">{c}</span>)}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function EmptyState({ onBrowse }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
      <PantryIcon className="h-16 w-16 text-zinc-800" />
      <h2 className="text-xl font-extrabold">Your pantry is empty</h2>
      <p className="max-w-xs text-warm-soft">
        Start collecting recipes you love — tap the heart on any recipe to keep it here.
      </p>
      <button className="btn-peach mt-2" onClick={onBrowse}>
        Browse all recipes
      </button>
    </div>
  )
}
