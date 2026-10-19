import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useData } from '../contexts/DataContext.jsx'
import { lastLiked, lastOpened } from '../lib/cookLaunch.js'
import { CookIcon } from '../components/icons.jsx'

// The Cook tab. Not a screen of its own: picks a recipe and replaces itself with that
// recipe's detail page in Cook Mode (RecipeDetail turns it on from `state.cook`).
// Order: last recipe opened, else last hearted, else an empty state.
export default function CookLaunch() {
  const navigate = useNavigate()
  const { recipes, pantryIds, loadingRecipes, getRecipe } = useData()
  const [none, setNone] = useState(false)

  useEffect(() => {
    if (loadingRecipes) return
    let alive = true
    const go = (id) => navigate(`/recipe/${id}`, { replace: true, state: { cook: true } })
    const fallback = () => {
      const liked = lastLiked(recipes, pantryIds)
      if (liked) go(liked)
      else setNone(true)
    }
    const last = lastOpened()
    if (last && recipes.some((r) => r.id === last)) go(last)
    // Last opened may be a friend's recipe (not in his own list), or one since deleted.
    else if (last) getRecipe(last).then((r) => { if (alive) r ? go(last) : fallback() }, () => { if (alive) fallback() })
    else fallback()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingRecipes])

  if (!none) return null

  const empty = recipes.length === 0
  return (
    <div className="animate-fadein py-16 text-center" data-cook-empty>
      <div className="mb-3 flex justify-center text-zinc-800"><CookIcon className="h-12 w-12" /></div>
      <h1 className="font-display text-2xl font-bold">{empty ? 'No recipes yet' : 'Nothing to cook yet'}</h1>
      <p className="mx-auto mt-2 max-w-xs text-warm-soft">
        {empty
          ? 'Add a recipe with the + button and Cook will open it here, step by step.'
          : 'Open or heart a recipe and Cook will jump straight back into it.'}
      </p>
      {empty
        ? <Link to="/new" className="btn-peach mt-5 inline-flex">Add a recipe</Link>
        : <Link to="/" className="btn-peach mt-5 inline-flex">Go to My Pantry</Link>}
    </div>
  )
}
