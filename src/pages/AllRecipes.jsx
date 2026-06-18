import { useMemo, useState } from 'react'
import { useData } from '../contexts/DataContext.jsx'
import RecipeCard from '../components/RecipeCard.jsx'
import { CategoryFilter, SearchBar, matchesQuery, matchesCategories } from '../components/Filters.jsx'
import { GridSkeleton } from '../components/Skeleton.jsx'

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
  const { recipes, loadingRecipes } = useData()
  const [query, setQuery] = useState('')
  const [cats, setCats] = useState([])
  const [sort, setSort] = useState('newest')

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
            <option key={k} value={k}>Sort: {v}</option>
          ))}
        </select>
      </header>

      <SearchBar value={query} onChange={setQuery} />
      <CategoryFilter selected={cats} onToggle={toggleCat} onClear={() => setCats([])} />

      {loadingRecipes ? (
        <GridSkeleton />
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-warm-soft">
          {recipes.length === 0 ? 'No recipes yet — tap the + to add your first one!' : 'No recipes match your search.'}
        </p>
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
