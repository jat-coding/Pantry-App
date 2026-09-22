import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useData } from '../contexts/DataContext.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { Check, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { useCookMode } from '../contexts/CookModeContext.jsx'
import { useGoBack } from '../lib/useGoBack.js'
import { useToast } from '../components/Toast.jsx'
import { formatIngredient, formatQty, abbreviateUnit, compatibleUnits, convertQty, parseQty } from '../lib/scaling.js'
import { aisleFor, getCategories, primaryCategory } from '../lib/categories.js'
import { EditIcon, TrashIcon, HeartIcon, CategoryIcon } from '../components/icons.jsx'
import SafeImage from '../components/SafeImage.jsx'
import { useImageSnapshot } from '../lib/useImageSnapshot.js'
import { AddToPantryPrompt } from './RecipeEditor.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'

function timeLabel(t) {
  if (!t || !t.value) return '—'
  return `${t.value} ${t.unit}`
}

export default function RecipeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { recipes, getRecipe, isInPantry, togglePantry, addGroceryItems, deleteRecipe, canWrite, updateRecipe } = useData()
  const toast = useToast()
  const goBack = useGoBack()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  // Set when navigated here right after creating a recipe.
  const [showPantryPrompt, setShowPantryPrompt] = useState(!!location.state?.promptPantry)

  const [recipe, setRecipe] = useState(() => recipes.find((r) => r.id === id) || null)
  const [loading, setLoading] = useState(!recipe)

  // Scaling + cook-mode state
  const [factor, setFactor] = useState(1)
  // Reader-chosen display units, keyed by ingredient index. Viewing-session
  // only — never written back to the recipe.
  const [units, setUnits] = useState({})
  // The quantity field being typed in right now, held as raw text so it can be
  // emptied and retyped instead of snapping back to the scaled value.
  const [qtyDraft, setQtyDraft] = useState(null)
  const [checked, setChecked] = useState(() => new Set())
  const { cookMode, setCookMode } = useCookMode()
  const [activeStep, setActiveStep] = useState(0)
  const wakeRef = useRef(null)
  const stepRefs = useRef([])

  // Cook Mode is app-wide state (Layout hides the bottom tab bar while it's
  // on) — turn it off if this page is left without an explicit Exit tap.
  useEffect(() => () => setCookMode(false), [])

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

  // Center the active step on screen as you move through Cook Mode.
  useEffect(() => {
    if (!cookMode) return
    const el = stepRefs.current[activeStep]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [activeStep, cookMode])

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

  useImageSnapshot(recipe, user, updateRecipe)

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

  // The unit an ingredient is currently shown in, and its quantity in that unit.
  const unitFor = (i) => units[i] || abbreviateUnit(recipe.ingredients[i]?.unit)
  const qtyIn = (i, qty) => convertQty(qty, recipe.ingredients[i]?.unit, unitFor(i))

  // Edit one ingredient's quantity -> rescale everything. The field is free text
  // so it can be cleared; an empty or half-typed value just parks the draft and
  // leaves the current scale alone until a real number lands.
  function editIngredientQty(index, text) {
    setQtyDraft({ index, text })
    const typed = parseQty(text)
    if (typed === '' || !Number.isFinite(typed) || typed <= 0) return
    const orig = Number(recipe.ingredients[index].qty)
    if (!orig || orig <= 0) return
    // Typed in the display unit; convert back to the recipe's own unit to scale.
    const inBase = convertQty(typed, unitFor(index), recipe.ingredients[index].unit)
    setFactor(Number(inBase) / orig)
  }

  function changeUnit(index, unit) {
    setUnits((u) => ({ ...u, [index]: unit }))
    setQtyDraft(null)
  }

  function changeServings(delta) {
    const base = recipe.servings || 1
    const current = Math.max(1, Math.round(base * factor))
    const target = Math.max(1, current + delta)
    setQtyDraft(null)
    setFactor(target / base)
  }

  function resetScale() {
    setQtyDraft(null)
    setUnits({})
    setFactor(1)
  }

  function toggleCheck(i) {
    setChecked((s) => {
      const n = new Set(s)
      n.has(i) ? n.delete(i) : n.add(i)
      return n
    })
  }

  async function doDelete() {
    setConfirmingDelete(false)
    try {
      await deleteRecipe(recipe.id)
      toast('Recipe deleted')
      goBack('/')
    } catch {
      toast('Could not delete recipe')
    }
  }

  async function handleAddToGrocery() {
    if (!canWrite) return toast('Log in to use the grocery list')
    // Send whatever the reader is looking at, units included.
    const items = scaledIngredients
      .map((ing, i) => ({ ing, i }))
      .filter(({ ing }) => ing.name)
      .map(({ ing, i }) => ({
        name: ing.name,
        qty: ing.qty === '' || ing.qty == null ? null : Math.round(Number(qtyIn(i, ing.qty)) * 100) / 100,
        unit: unitFor(i) || '',
        fromRecipe: recipe.title,
        category: aisleFor(ing.name),
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
      {/* Cook-mode exit bar pinned to the top (clears the Dynamic Island / status bar). */}
      {cookMode && (
        <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-between border-b border-warm/10 bg-white/95 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] backdrop-blur sm:left-60">
          <span className="font-extrabold">Cook Mode</span>
          <button
            onClick={() => { setCookMode(false); setActiveStep(0) }}
            className="flex items-center gap-1 rounded-full bg-eggshell px-3 py-1.5 text-sm font-bold text-warm shadow-card active:scale-95"
            aria-label="Exit Cook Mode"
          >Exit <X className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" /></button>
        </div>
      )}

      {/* Hero */}
      <div className="relative -mx-4 -mt-5 mb-4 h-56 overflow-hidden sm:-mx-8 sm:rounded-b-3xl">
        {recipe.videoUrl ? (
          <video src={recipe.videoUrl} controls playsInline className="h-full w-full bg-black object-cover" />
        ) : (
          <SafeImage src={recipe.imageUrl} alt={recipe.title} className="h-full w-full object-cover"
            fallback={
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-peach/50 to-surface-2 text-peach-dark">
                <CategoryIcon category={primaryCategory(recipe)} className="h-24 w-24" />
              </div>
            } />
        )}
        <button
          onClick={() => goBack('/recipes')}
          className="absolute left-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 shadow-card backdrop-blur"
          aria-label="Back"
        ><ChevronLeft className="h-5 w-5 text-warm" strokeWidth={2.2} aria-hidden="true" /></button>
        <div className="absolute right-3 top-3 flex gap-2">
          {isOwner && (
            <>
              <button
                onClick={() => navigate(`/recipe/${recipe.id}/edit`)}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-zinc-800 shadow-card backdrop-blur"
                aria-label="Edit recipe"
              ><EditIcon className="h-5 w-5" /></button>
              <button
                onClick={() => setConfirmingDelete(true)}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-red-600 shadow-card backdrop-blur"
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
        <div className="flex flex-wrap gap-2">
          {getCategories(recipe).map((c) => <span key={c} className="pill-peach">{c}</span>)}
        </div>
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
            {(factor !== 1 || Object.keys(units).length > 0) && (
              <button onClick={resetScale} className="ml-1 text-sm font-bold text-peach-dark underline">Reset</button>
            )}
          </div>
        </div>
        <p className="mb-2 text-xs text-warm-soft">Tip: edit any quantity and the rest scale to match. Tap a unit to switch it.</p>

        <ul className="card divide-y divide-warm/5 overflow-hidden">
          {scaledIngredients.map((ing, i) => {
            const pretty = formatIngredient(ing)
            const isChecked = checked.has(i)
            const unit = unitFor(i)
            const options = compatibleUnits(recipe.ingredients[i]?.unit)
            const hasQty = !(ing.qty === '' || ing.qty == null)
            const value = qtyDraft?.index === i
              ? qtyDraft.text
              : hasQty ? String(Math.round(Number(qtyIn(i, ing.qty)) * 100) / 100) : ''
            return (
              <li key={i} className="flex items-center gap-3 p-3">
                <button
                  onClick={() => toggleCheck(i)}
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${
                    isChecked ? 'border-peach-dark bg-peach-dark text-white' : 'border-warm/30'
                  }`}
                  aria-label="Toggle ingredient"
                >{isChecked ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" /> : ''}</button>

                {hasQty ? (
                  <input
                    type="text"
                    inputMode="decimal"
                    value={value}
                    onChange={(e) => editIngredientQty(i, e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onBlur={() => setQtyDraft(null)}
                    aria-label={`Amount of ${ing.name}`}
                    className="w-16 shrink-0 rounded-lg border border-warm/15 bg-eggshell px-2 py-1 text-center text-sm font-bold outline-none focus:border-peach-dark"
                  />
                ) : (
                  <span className="w-16 shrink-0 text-center text-sm text-warm-soft">—</span>
                )}

                <span className={`min-w-0 flex-1 ${isChecked ? 'text-warm-soft line-through' : ''}`}>
                  {ing.name}
                  {!units[i] && pretty.qtyLabel && (
                    <span className="ml-1 text-xs text-warm-soft">({pretty.qtyLabel} {abbreviateUnit(pretty.unit)})</span>
                  )}
                </span>

                {/* Unit sits at the far end of the row, well clear of the amount
                    field, so switching units is never a mis-tap on the number. */}
                {options.length > 1 ? (
                  <select
                    value={unit}
                    onChange={(e) => changeUnit(i, e.target.value)}
                    aria-label={`Unit for ${ing.name}`}
                    className="ml-2 h-8 w-[4.5rem] shrink-0 rounded-lg border border-warm/15 bg-white px-1 text-center text-sm font-bold text-warm-soft outline-none focus:border-peach-dark"
                  >
                    {options.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                ) : (
                  <span className="ml-2 w-[4.5rem] shrink-0 truncate text-center text-sm text-warm-soft">{unit}</span>
                )}
              </li>
            )
          })}
        </ul>

        <button onClick={handleAddToGrocery} className="btn-ghost mt-3 w-full">
          Add to Grocery List
        </button>
      </section>

      {/* Instructions */}
      <section className={cookMode ? 'pb-48' : ''}>
        <h2 className="mb-2 text-xl font-extrabold">Instructions</h2>
        <ol className="space-y-3">
          {recipe.instructions.map((step, i) => {
            const active = cookMode && i === activeStep
            return (
              <li
                key={i}
                ref={(el) => (stepRefs.current[i] = el)}
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

      {/* Cook-mode step controls — sit just above the mobile tab bar (and at the
          bottom on desktop, where there's a sidebar instead of a tab bar). */}
      {cookMode && (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] z-50 flex items-center gap-3 border-t border-warm/10 bg-white/95 p-3 backdrop-blur sm:bottom-0 sm:left-60">
          <button
            onClick={() => setActiveStep((s) => Math.max(0, s - 1))}
            disabled={activeStep === 0}
            className="btn-ghost flex-1 disabled:opacity-40"
          ><ChevronLeft className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" /> Prev</button>
          <span className="text-sm font-bold text-warm-soft">
            Step {activeStep + 1}/{recipe.instructions.length}
          </span>
          <button
            onClick={() => setActiveStep((s) => Math.min(recipe.instructions.length - 1, s + 1))}
            disabled={activeStep === recipe.instructions.length - 1}
            className="btn-peach flex-1 disabled:opacity-40"
          >Next <ChevronRight className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" /></button>
        </div>
      )}

      {showPantryPrompt && !inPantry && (
        <AddToPantryPrompt
          onYes={async () => { await togglePantry(recipe.id); toast('Added to Pantry'); setShowPantryPrompt(false) }}
          onNo={() => setShowPantryPrompt(false)}
        />
      )}

      {confirmingDelete && (
        <ConfirmDialog
          message="Delete this recipe? This cannot be undone."
          confirmLabel="Delete"
          danger
          onConfirm={doDelete}
          onCancel={() => setConfirmingDelete(false)}
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
