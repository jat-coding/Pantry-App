import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useData } from '../contexts/DataContext.jsx'
import RecipeCard from '../components/RecipeCard.jsx'
import { CategoryFilter, SearchBar, matchesQuery, matchesCategories } from '../components/Filters.jsx'
import { GridSkeleton } from '../components/Skeleton.jsx'
import ImportModal from './ImportModal.jsx'
import { useToast } from '../components/Toast.jsx'
import { LinkIcon, EditIcon } from '../components/icons.jsx'

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
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [cats, setCats] = useState([])
  const [sort, setSort] = useState('newest')
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [sharedUrl, setSharedUrl] = useState('')

  // Opened via a shared link, e.g. /recipes?import=<url> from the iOS Shortcut
  // or Android share target. Open the importer prefilled, then strip the param
  // so a refresh doesn't re-import.
  useEffect(() => {
    const shared = searchParams.get('import')
    if (!shared) return
    if (!canWrite) { toast('Log in to import a recipe'); }
    setSharedUrl(shared)
    setShowImport(true)
    searchParams.delete('import')
    setSearchParams(searchParams, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  function toggleCat(c) {
    setCats((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]))
  }

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
          <h1 className="text-3xl font-extrabold">All Recipes</h1>
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
      <CategoryFilter selected={cats} onToggle={toggleCat} onClear={() => setCats([])} />

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
            <button className="flex w-full items-center gap-2 rounded-xl px-4 py-3 text-left font-bold hover:bg-eggshell"
              onClick={() => handleAdd('import')}>
              <LinkIcon className="h-5 w-5 text-zinc-800" /> Import Recipe
            </button>
            <button className="flex w-full items-center gap-2 rounded-xl px-4 py-3 text-left font-bold hover:bg-eggshell"
              onClick={() => handleAdd('scratch')}>
              <EditIcon className="h-5 w-5 text-zinc-800" /> Create from Scratch
            </button>
          </div>
        )}
        <button
          onClick={() => setShowAdd((s) => !s)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-cta text-3xl text-white shadow-card-hover transition active:scale-90 hover:bg-cta-dark"
          aria-label="Add recipe"
        >
          {showAdd ? '×' : '+'}
        </button>
      </div>

      {showImport && (
        <ImportModal
          initialUrl={sharedUrl}
          onClose={() => { setShowImport(false); setSharedUrl('') }}
        />
      )}
    </div>
  )
}
