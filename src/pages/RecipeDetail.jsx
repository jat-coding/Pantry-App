import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useData } from '../contexts/DataContext.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../components/Toast.jsx'
import { formatIngredient, formatQty } from '../lib/scaling.js'
import { aisleFor, CATEGORY_EMOJI } from '../lib/categories.js'
import { EditIcon, TrashIcon, HeartIcon } from '../components/icons.jsx'
import { AddToPantryPrompt } from './RecipeEditor.jsx'

function timeLabel(t) {
  if (!t || !t.value) return '—'
  return `${t.value} ${t.unit}`
}

export default function RecipeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { recipes, getRecipe, isInPantry, togglePantry, addGroceryItems, deleteRecipe, canWrite } = useData()
  const toast = useToast()
  // Set when navigated here right after creating a recipe.
  const [showPantryPrompt, setShowPantryPrompt] = useState(!!location.state?.promptPantry)

  const [recipe, setRecipe] = useState(() => recipes.find((r) => r.id === id) || null)
  const [loading, setLoading] = useState(!recipe)

  // Scaling + cook-mode state
  const [factor, setFactor] = useState(1)
  const [checked, setChecked] = useState(() => new Set())
  const [cookMode, setCookMode] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const wakeRef = useRef(null)

  useEffect(() => {
    let alive = true
    if (!recipe) {
      getRecipe(id).then((r) => {
        if (!alive) return
        setRecipe(r)
        setLoading(false)
      })
    }
    return () => { alive = false }
  }, [id])

  // Keep a fresh copy if the live list updates.
  useEffect(() => {
    const live = recipes.find((r) => r.id === id)
    if (live) setRecipe(live)
  }, [recipes, id])

  // ----- Wake Lock for Cook Mode -----
  useEffect(() => {
    async function acquire() {
      try {
        if ('wakeLock' in navigator) {
          wakeRef.current = await navigator.wakeLock.request('screen')
        }
      } catch { /* user may have denied or unsupported */ }
    }
    function release() {
      try { wakeRef.current?.release() } catch {}
      wakeRef.current = null
    }
    if (cookMode) acquire()
    else release()

    const onVis = () => { if (cookMode && document.visibilityState === 'visible') acquire() }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      release()
    }
  }, [cookMode])

  const original = recipe
  const scaledIngredients = useMemo(() => {
    if (!original) return []
    return original.ingredients.map((ing) => ({
      ...ing,
      qty: ing.qty === '' || ing.qty == null ? ing.qty : Number(ing.qty) * factor,
    }))
  }, [original, factor])

  if (loading) return <div className="py-20 text-center text-warm-soft">Loading recipe…</div>
  if (!recipe) return <div className="py-20 text-center text-warm-soft">Recipe not found.</div>

  const inPantry = isInPantry(recipe.id)
  const isOwner = user && recipe.authorId === user.uid
  const scaledServings = formatQty((recipe.servings || 1) * factor)

  // Edit one ingredient's quantity -> rescale everything.
  function editIngredientQty(index, value) {
    const orig = Number(recipe.ingredients[index].qty)
    const next = parseFloat(value)
    if (!orig || orig <= 0 || !Number.isFinite(next)) return
    setFactor(next / orig)
  }

  function changeServings(delta) {
    const base = recipe.servings || 1
    const current = Math.max(1, Math.round(base * factor))
    const target = Math.max(1, current + delta)
    setFactor(target / base)
  }

  function toggleCheck(i) {
    setChecked((s) => {
      const n = new Set(s)
      n.has(i) ? n.delete(i) : n.add(i)
      return n
    })
  }

  async function handleDelete() {
    if (!window.confirm('Delete this recipe? This cannot be undone.')) return
    try {
      await deleteRecipe(recipe.id)
      toast('Recipe deleted')
      navigate('/', { replace: true })
    } catch {
      toast('Could not delete recipe')
    }
  }

  async function handleAddToGrocery() {
    if (!canWrite) return toast('Log in to use the grocery list')
    const items = scaledIngredients
      .filter((i) => i.name)
      .map((i) => ({
        name: i.name,
        qty: i.qty === '' || i.qty == null ? null : Math.round(Number(i.qty) * 100) / 100,
        unit: i.unit || '',
        fromRecipe: recipe.title,
        category: aisleFor(i.name),
      }))
    try {
      await addGroceryItems(items)
      toast('Added to grocery list')
    } catch {
      toast('Could not add to grocery list')
    }
  }

  return (
    <div className={`animate-fadein ${cookMode ? 'text-[1.06rem]' : ''}`}>
      {/* Hero */}
      <div className="relative -mx-4 -mt-5 mb-4 h-56 overflow-hidden sm:-mx-8 sm:rounded-b-3xl">
        {recipe.imageUrl ? (
          <img src={recipe.imageUrl} alt={recipe.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-peach/40 text-7xl">
            {CATEGORY_EMOJI[recipe.category] || '🍽️'}
          </div>
        )}
        <button
          onClick={() => navigate(-1)}
          className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-card backdrop-blur"
          aria-label="Back"
        >←</button>
        <div className="absolute right-3 top-3 flex gap-2">
          {isOwner && (
            <>
              <button
                onClick={() => navigate(`/recipe/${recipe.id}/edit`)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-zinc-800 shadow-card backdrop-blur"
                aria-label="Edit recipe"
              ><EditIcon className="h-5 w-5" /></button>
              <button
                onClick={handleDelete}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-red-600 shadow-card backdrop-blur"
                aria-label="Delete recipe"
              ><TrashIcon className="h-5 w-5" /></button>
            </>
          )}
          <button
            onClick={() => (canWrite ? togglePantry(recipe.id) : toast('Log in to save recipes'))}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-zinc-800 shadow-card backdrop-blur active:scale-90"
            aria-label="Toggle pantry"
          ><HeartIcon filled={inPantry} className="h-5 w-5" /></button>
        </div>
      </div>

      <div className="mb-4">
        <span className="pill-peach">{recipe.category}</span>
        <h1 className="mt-2 text-2xl font-extrabold leading-tight">{recipe.title}</h1>
        <p className="text-sm text-warm-soft">
          {recipe.pocketedFromName ? `Pocketed from ${recipe.pocketedFromName}` : `by ${recipe.authorName}`}
        </p>
      </div>

      {/* Stats */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        <Stat label="Prep" value={timeLabel(recipe.prepTime)} />
        <Stat label="Cook" value={timeLabel(recipe.cookTime)} />
        <Stat label="Servings" value={scaledServings} />
      </div>

      {/* Cook mode toggle */}
      <label className="mb-5 flex items-center justify-between rounded-2xl bg-white p-4 shadow-card">
        <span className="font-bold">Cook Mode <span className="text-xs font-normal text-warm-soft">(keeps screen awake)</span></span>
        <input type="checkbox" className="peer sr-only" checked={cookMode}
          onChange={(e) => { setCookMode(e.target.checked); setActiveStep(0) }} />
        <span className="relative h-7 w-12 rounded-full bg-warm/20 transition peer-checked:bg-peach-dark
          after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
      </label>

      {/* Ingredients with scaling */}
      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xl font-extrabold">Ingredients</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => changeServings(-1)} className="h-8 w-8 rounded-full bg-white shadow-card font-extrabold">−</button>
            <span className="min-w-[5rem] text-center text-sm font-bold">{scaledServings} servings</span>
            <button onClick={() => changeServings(1)} className="h-8 w-8 rounded-full bg-white shadow-card font-extrabold">+</button>
            {factor !== 1 && (
              <button onClick={() => setFactor(1)} className="ml-1 text-sm font-bold text-peach-dark underline">Reset</button>
            )}
          </div>
        </div>
        <p className="mb-2 text-xs text-warm-soft">Tip: edit any quantity and the rest scale to match.</p>

        <ul className="card divide-y divide-warm/5 overflow-hidden">
          {scaledIngredients.map((ing, i) => {
            const pretty = formatIngredient(ing)
            const isChecked = checked.has(i)
            return (
              <li key={i} className="flex items-center gap-3 p-3">
                <button
                  onClick={() => toggleCheck(i)}
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${
                    isChecked ? 'border-peach-dark bg-peach-dark text-white' : 'border-warm/30'
                  }`}
                  aria-label="Toggle ingredient"
                >{isChecked ? '✓' : ''}</button>

                {ing.qty === '' || ing.qty == null ? (
                  <span className="w-16 shrink-0 text-center text-sm text-warm-soft">—</span>
                ) : (
                  <input
                    type="number"
                    step="any"
                    value={Math.round(Number(ing.qty) * 100) / 100}
                    onChange={(e) => editIngredientQty(i, e.target.value)}
                    className="w-16 shrink-0 rounded-lg border border-warm/15 bg-eggshell px-2 py-1 text-center text-sm font-bold outline-none focus:border-peach-dark"
                  />
                )}
                <span className="w-12 shrink-0 text-sm text-warm-soft">{ing.unit}</span>
                <span className={`flex-1 ${isChecked ? 'text-warm-soft line-through' : ''}`}>
                  {ing.name}
                  {pretty.qtyLabel && (
                    <span className="ml-1 text-xs text-warm-soft">({pretty.qtyLabel} {pretty.unit})</span>
                  )}
                </span>
              </li>
            )
          })}
        </ul>

        <button onClick={handleAddToGrocery} className="btn-ghost mt-3 w-full">
          Add to Grocery List
        </button>
      </section>

      {/* Instructions */}
      <section className={cookMode ? 'pb-24' : ''}>
        <h2 className="mb-2 text-xl font-extrabold">Instructions</h2>
        <ol className="space-y-3">
          {recipe.instructions.map((step, i) => {
            const active = cookMode && i === activeStep
            return (
              <li
                key={i}
                onClick={() => cookMode && setActiveStep(i)}
                className={`flex gap-3 rounded-2xl p-4 transition ${
                  active ? 'bg-peach text-warm shadow-card-hover' : 'bg-white shadow-card'
                } ${cookMode ? 'cursor-pointer' : ''}`}
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${
                  active ? 'bg-white text-warm' : 'bg-peach/40'
                }`}>{i + 1}</span>
                <span className={cookMode ? 'text-lg leading-relaxed' : ''}>{step}</span>
              </li>
            )
          })}
        </ol>
      </section>

      {/* Cook-mode step controls pinned to bottom */}
      {cookMode && (
        <div className="fixed inset-x-0 bottom-0 z-50 flex items-center gap-3 border-t border-warm/10 bg-white/95 p-3 backdrop-blur sm:left-60">
          <button
            onClick={() => setActiveStep((s) => Math.max(0, s - 1))}
            disabled={activeStep === 0}
            className="btn-ghost flex-1 disabled:opacity-40"
          >← Prev</button>
          <span className="text-sm font-bold text-warm-soft">
            Step {activeStep + 1}/{recipe.instructions.length}
          </span>
          <button
            onClick={() => setActiveStep((s) => Math.min(recipe.instructions.length - 1, s + 1))}
            disabled={activeStep === recipe.instructions.length - 1}
            className="btn-peach flex-1 disabled:opacity-40"
          >Next →</button>
        </div>
      )}

      {showPantryPrompt && !inPantry && (
        <AddToPantryPrompt
          onYes={async () => { await togglePantry(recipe.id); toast('Added to Pantry'); setShowPantryPrompt(false) }}
          onNo={() => setShowPantryPrompt(false)}
        />
      )}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="card flex flex-col items-center py-3">
      <span className="text-xs font-bold uppercase tracking-wide text-warm-soft">{label}</span>
      <span className="text-lg font-extrabold">{value}</span>
    </div>
  )
}
