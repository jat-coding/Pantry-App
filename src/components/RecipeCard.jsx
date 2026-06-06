import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../contexts/DataContext.jsx'
import { useToast } from './Toast.jsx'
import { CATEGORY_EMOJI } from '../lib/categories.js'

function totalTime(recipe) {
  const toMin = (t) => (t ? (t.unit === 'hr' ? t.value * 60 : t.value) : 0)
  const mins = toMin(recipe.prepTime) + toMin(recipe.cookTime)
  if (!mins) return null
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

function Heart({ filled }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        d="M12 21s-7.5-4.6-10-9.2C.4 8.4 2 5 5.3 5c2 0 3.3 1.1 4.2 2.3C10.4 6.1 11.7 5 13.7 5 17 5 18.6 8.4 17 11.8 14.5 16.4 12 21 12 21z"
        fill={filled ? '#FFCBA4' : 'none'}
        stroke={filled ? '#F2A977' : '#2C2416'}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function RecipeCard({ recipe, showPocket = false, onPocket }) {
  const navigate = useNavigate()
  const { isInPantry, togglePantry, canWrite } = useData()
  const toast = useToast()
  const inPantry = isInPantry(recipe.id)
  const [popping, setPopping] = useState(false)
  const time = totalTime(recipe)

  async function handleHeart(e) {
    e.stopPropagation()
    if (!canWrite) return toast('Log in to save recipes')
    setPopping(true)
    setTimeout(() => setPopping(false), 350)
    try {
      await togglePantry(recipe.id)
      toast(inPantry ? 'Removed from Pantry' : 'Added to Pantry 🫙')
    } catch {
      toast('Could not update Pantry')
    }
  }

  return (
    <button
      onClick={() => navigate(`/recipe/${recipe.id}`)}
      className="card group flex flex-col overflow-hidden text-left transition hover:shadow-card-hover sm:hover:-translate-y-1"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-peach/30">
        {recipe.imageUrl ? (
          <img
            src={recipe.imageUrl}
            alt={recipe.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-5xl">
            {CATEGORY_EMOJI[recipe.category] || '🍽️'}
          </div>
        )}

        <span
          onClick={handleHeart}
          className={`absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-card backdrop-blur transition active:scale-90 ${
            popping ? 'animate-pop' : ''
          }`}
          role="button"
          aria-label={inPantry ? 'Remove from Pantry' : 'Add to Pantry'}
        >
          <Heart filled={inPantry} />
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2">
          <span className="pill-peach">{recipe.category}</span>
          {time && <span className="text-xs font-semibold text-warm-soft">⏱ {time}</span>}
        </div>
        <h3 className="font-extrabold leading-tight">{recipe.title}</h3>
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
            Pocket
          </span>
        )}
      </div>
    </button>
  )
}
