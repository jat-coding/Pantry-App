import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../contexts/DataContext.jsx'
import RecipeCard from '../components/RecipeCard.jsx'
import { CategoryFilter, SearchBar, matchesQuery } from '../components/Filters.jsx'
import { GridSkeleton } from '../components/Skeleton.jsx'
import ImportModal from './ImportModal.jsx'
import { useToast } from '../components/Toast.jsx'

const SORTS = {
  newest: 'Newest',
  az: 'A–Z',
  time: 'Cook time',
}

function totalMin(r) {
  const toMin = (t) => (t ? (t.unit === 'hr' ? t.value * 60 : t.value) : 0)
  return toMin(r.prepTime) + toMin(r.cookTime)
}

export default function AllRecipes() {
  const { recipes, loadingRecipes, canWrite } = useData()
  const navigate = useNavigate()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [sort, setSort] = useState('newest')
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)

  const filtered = useMemo(() => {
    const list = recipes.filter(
      (r) => (category === 'All' || r.category === category) && matchesQuery(r, query),
    )
    const sorted = [...list]
    if (sort === 'az') sorted.sort((a, b) => a.title.localeCompare(b.title))
    else if (sort === 'time') sorted.sort((a, b) => totalMin(a) - totalMin(b))
    else sorted.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    return sorted
  }, [recipes, query, category, sort])

  function handleAdd(kind) {
    setShowAdd(false)
    if (!canWrite) return toast('Log in to add recipes')
    if (kind === 'scratch') navigate('/new')
    else setShowImport(true)
  }

  return (
    <div className="animate-fadein space-y-5">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-extrabold">All Recipes 📖</h1>
          <p className="text-warm-soft">Everything in your collection.</p>
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded-2xl border border-warm/15 bg-white px-3 py-2 text-sm font-bold outline-none"
        >
          {Object.entries(SORTS).map(([k, v]) => (
            <option key={k} value={k}>
              Sort: {v}
            </option>
          ))}
        </select>
      </header>

      <SearchBar value={query} onChange={setQuery} />
      <CategoryFilter selected={category} onSelect={setCategory} />

      {loadingRecipes ? (
        <GridSkeleton />
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-warm-soft">
          {recipes.length === 0 ? 'No recipes yet — add your first one!' : 'No recipes match your search.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <RecipeCard key={r.id} recipe={r} />
          ))}
        </div>
      )}

      {/* Floating add button */}
      <div className="fixed bottom-24 right-5 z-40 sm:bottom-8 sm:right-8">
        {showAdd && (
          <div className="absolute bottom-16 right-0 w-52 animate-fadein space-y-1 rounded-2xl bg-white p-2 shadow-card-hover">
            <button className="w-full rounded-xl px-4 py-3 text-left font-bold hover:bg-eggshell"
              onClick={() => handleAdd('import')}>
              📥 Import Recipe
            </button>
            <button className="w-full rounded-xl px-4 py-3 text-left font-bold hover:bg-eggshell"
              onClick={() => handleAdd('scratch')}>
              ✏️ Create from Scratch
            </button>
          </div>
        )}
        <button
          onClick={() => setShowAdd((s) => !s)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-peach text-3xl text-warm shadow-card-hover transition active:scale-90 hover:bg-peach-dark"
          aria-label="Add recipe"
        >
          {showAdd ? '×' : '+'}
        </button>
      </div>

      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
    </div>
  )
}
