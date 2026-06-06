import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../contexts/DataContext.jsx'
import RecipeCard from '../components/RecipeCard.jsx'
import { CategoryFilter, SearchBar, matchesQuery } from '../components/Filters.jsx'
import { GridSkeleton } from '../components/Skeleton.jsx'

export default function Pantry() {
  const { pantryRecipes, loadingRecipes } = useData()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')

  const filtered = useMemo(() => {
    return pantryRecipes.filter(
      (r) => (category === 'All' || r.category === category) && matchesQuery(r, query),
    )
  }, [pantryRecipes, query, category])

  return (
    <div className="animate-fadein space-y-5">
      <header>
        <h1 className="text-3xl font-extrabold">My Pantry 🫙</h1>
        <p className="text-warm-soft">The recipes you love, all in one place.</p>
      </header>

      <SearchBar value={query} onChange={setQuery} />
      <CategoryFilter selected={category} onSelect={setCategory} />

      {loadingRecipes ? (
        <GridSkeleton />
      ) : pantryRecipes.length === 0 ? (
        <EmptyState onBrowse={() => navigate('/recipes')} />
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-warm-soft">No recipes match your search.</p>
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

function EmptyState({ onBrowse }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
      <div className="text-6xl">🫙</div>
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
