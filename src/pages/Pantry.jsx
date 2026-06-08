import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../contexts/DataContext.jsx'
import RecipeCard from '../components/RecipeCard.jsx'
import { CategoryFilter, SearchBar, matchesQuery } from '../components/Filters.jsx'
import { GridSkeleton } from '../components/Skeleton.jsx'
import { GridIcon, ListIcon } from '../components/icons.jsx'

const VIEW_KEY = 'pantry-view'

function totalTime(recipe) {
  const toMin = (t) => (t ? (t.unit === 'hr' ? t.value * 60 : t.value) : 0)
  const mins = toMin(recipe.prepTime) + toMin(recipe.cookTime)
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
  const [category, setCategory] = useState('All')
  const [view, setView] = useState(() => localStorage.getItem(VIEW_KEY) || 'grid')

  function setViewPersist(v) {
    setView(v)
    localStorage.setItem(VIEW_KEY, v)
  }

  const filtered = useMemo(() => {
    return pantryRecipes.filter(
      (r) => (category === 'All' || r.category === category) && matchesQuery(r, query),
    )
  }, [pantryRecipes, query, category])

  return (
    <div className="animate-fadein space-y-5">
      <header>
        <h1 className="text-3xl font-extrabold">My Pantry</h1>
        <p className="text-warm-soft">The recipes you love, all in one place.</p>
      </header>

      <SearchBar value={query} onChange={setQuery} />

      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <CategoryFilter selected={category} onSelect={setCategory} />
        </div>
        <ViewToggle view={view} onChange={setViewPersist} />
      </div>

      {loadingRecipes ? (
        <GridSkeleton />
      ) : pantryRecipes.length === 0 ? (
        <EmptyState onBrowse={() => navigate('/recipes')} />
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-warm-soft">No recipes match your search.</p>
      ) : view === 'list' ? (
        <RecipeListView recipes={filtered} onOpen={(id) => navigate(`/recipe/${id}`)} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <RecipeCard key={r.id} recipe={r} />
          ))}
        </div>
      )}
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
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{r.title}</span>
                  <span className="block truncate text-xs text-warm-soft">
                    {r.pocketedFromName ? `Pocketed from ${r.pocketedFromName}` : `by ${r.authorName}`}
                  </span>
                </span>
                <span className="w-20 text-right text-xs font-semibold text-warm-soft">
                  {time || '—'}
                </span>
                <span className="w-24 text-right">
                  <span className="pill-peach">{r.category}</span>
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
      <PantryIconLarge />
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

function PantryIconLarge() {
  return (
    <svg viewBox="0 0 24 24" className="h-16 w-16 text-peach-dark" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9.5h18" />
      <path d="M3 17.5h18" />
      <rect x="5.8" y="5" width="3.2" height="4.5" rx="0.8" />
      <rect x="10.4" y="5" width="3.2" height="4.5" rx="0.8" />
      <rect x="15" y="5" width="3.2" height="4.5" rx="0.8" />
      <rect x="8" y="13" width="3.2" height="4.5" rx="0.8" />
      <rect x="12.8" y="13" width="3.2" height="4.5" rx="0.8" />
    </svg>
  )
}
