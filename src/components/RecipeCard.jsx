import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useData } from '../contexts/DataContext.jsx'
import { useToast } from './Toast.jsx'
import { getCategories, primaryCategory } from '../lib/categories.js'
import { CategoryIcon, HeartIcon } from './icons.jsx'
import SafeImage from './SafeImage.jsx'

function totalTime(recipe) {
  const toMin = (t) => (t ? (t.unit === 'hr' ? t.value * 60 : t.value) : 0)
  const mins = toMin(recipe.prepTime) + toMin(recipe.cookTime)
  if (!mins) return null
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}


export default function RecipeCard({ recipe, showPocket = false, onPocket, pocketLabel = 'Pocket' }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { isInPantry, togglePantry, canWrite } = useData()
  const toast = useToast()
  const inPantry = isInPantry(recipe.id)
  const [popping, setPopping] = useState(false)
  const time = totalTime(recipe)
  const cats = getCategories(recipe)

  async function handleHeart(e) {
    e.stopPropagation()
    if (!canWrite) return toast('Log in to save recipes')
    setPopping(true)
    setTimeout(() => setPopping(false), 350)
    try {
      await togglePantry(recipe.id)
      toast(inPantry ? 'Removed from Pantry' : 'Added to Pantry')
    } catch {
      toast('Could not update Pantry')
    }
  }

  return (
    <button
      onClick={() => navigate(`/recipe/${recipe.id}`, { state: { from: location.pathname } })}
      className="card group flex flex-col overflow-hidden text-left transition hover:shadow-card-hover sm:hover:-translate-y-1"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-peach/40 to-surface-2">
        <SafeImage
          src={recipe.imageUrl}
          alt={recipe.title}
          loading="lazy"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          fallback={
            <div className="flex h-full w-full items-center justify-center text-peach-dark">
              <CategoryIcon category={primaryCategory(recipe)} className="h-16 w-16" />
            </div>
          }
        />

        <span
          onClick={handleHeart}
          className={`absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 shadow-card backdrop-blur transition active:scale-90 ${
            popping ? 'animate-pop' : ''
          }`}
          role="button"
          aria-label={inPantry ? 'Remove from Pantry' : 'Add to Pantry'}
        >
          <HeartIcon filled={inPantry} className="h-5 w-5 text-warm" />
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {cats.map((c) => <span key={c} className="pill-peach">{c}</span>)}
          {time && <span className="text-xs font-semibold text-warm-soft">{time}</span>}
        </div>
        <h3 className="font-display text-lg font-bold leading-tight">{recipe.title}</h3>
        <p className="mt-auto text-xs text-warm-soft">
          {recipe.pocketedFromName
            ? `Pocketed from ${recipe.pocketedFromName}`
            : `by ${recipe.authorName}`}
        </p>

        {showPocket && (
          <span
            onClick={(e) => { e.stopPropagation(); onPocket?.(recipe) }}
            role="button"
            className="btn-peach mt-1 w-full py-2 text-sm"
          >
            {pocketLabel}
          </span>
        )}
      </div>
    </button>
  )
}
