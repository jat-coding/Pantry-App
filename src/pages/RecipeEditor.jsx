import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useData } from '../contexts/DataContext.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../components/Toast.jsx'
import { CATEGORIES } from '../lib/categories.js'
import { parseQty } from '../lib/scaling.js'
import { sanitizeRecipe } from '../lib/recipeShape.js'
import { uploadImage } from '../lib/storage.js'
import { PantryIcon, CameraIcon } from '../components/icons.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'

const DRAFT_KEY = 'pantry-draft-new'

function blankRecipe() {
  return {
    title: '',
    imageUrl: '',
    category: 'Dinner',
    categories: ['Dinner'],
    prepTime: { value: 10, unit: 'min' },
    cookTime: { value: 20, unit: 'min' },
    servings: 4,
    ingredients: [{ qty: '', unit: '', name: '' }],
    instructions: [''],
    isPublic: false,
  }
}

export default function RecipeEditor() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()
  const location = useLocation()
  const { recipes, getRecipe, createRecipe, updateRecipe } = useData()
  const { user } = useAuth()
  const toast = useToast()

  const [form, setForm] = useState(blankRecipe)
  const [dirty, setDirty] = useState(false)
  const [loaded, setLoaded] = useState(!isEdit)
  const [saving, setSaving] = useState(false)
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const initial = useRef(true)

  // Load existing recipe (edit) or restore draft (new).
  useEffect(() => {
    if (isEdit) {
      const live = recipes.find((r) => r.id === id)
      const apply = (r) => {
        if (r) setForm(sanitizeRecipe({ ...blankRecipe(), ...r }))
        setLoaded(true)
      }
      live ? apply(live) : getRecipe(id).then(apply)
    } else {
      const saved = localStorage.getItem(DRAFT_KEY)
      if (saved) {
        try { setForm(sanitizeRecipe({ ...blankRecipe(), ...JSON.parse(saved) })) } catch {}
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Auto-save draft to localStorage while editing a NEW recipe.
  useEffect(() => {
    if (initial.current) { initial.current = false; return }
    setDirty(true)
    if (!isEdit) localStorage.setItem(DRAFT_KEY, JSON.stringify(form))
  }, [form, isEdit])

  // Warn before leaving with unsaved changes (browser nav).
  useEffect(() => {
    const handler = (e) => { if (dirty) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })) }

  // Toggle a category on/off; never allow zero selected (keep at least one).
  function toggleCategory(c) {
    setForm((f) => {
      const current = Array.isArray(f.categories) && f.categories.length
        ? f.categories
        : (f.category ? [f.category] : [])
      const has = current.includes(c)
      const next = has ? current.filter((x) => x !== c) : [...current, c]
      const categories = next.length ? next : current
      return { ...f, categories, category: categories[0] }
    })
  }

  async function handlePhotoFile(file) {
    if (!file) return
    setUploadingPhoto(true)
    try {
      // Uploads to Firebase Storage when available; otherwise falls back to a
      // size-capped inline data URL so saving still works.
      const url = await uploadImage(file, `recipes/${user?.uid || 'anon'}`)
      set('imageUrl', url)
    } catch (err) {
      // Surface the specific reason (too large, timed out, unreadable) — a
      // generic message leaves people retrying the same photo forever.
      toast(err?.message || 'Could not load that photo')
    } finally {
      setUploadingPhoto(false)
    }
  }

  function setIngredient(i, key, value) {
    setForm((f) => {
      const ingredients = f.ingredients.map((ing, idx) =>
        idx === i ? { ...ing, [key]: value } : ing)
      return { ...f, ingredients }
    })
  }
  function addIngredient() { setForm((f) => ({ ...f, ingredients: [...f.ingredients, { qty: '', unit: '', name: '' }] })) }
  function removeIngredient(i) { setForm((f) => ({ ...f, ingredients: f.ingredients.filter((_, idx) => idx !== i) })) }

  function setStep(i, value) {
    setForm((f) => ({ ...f, instructions: f.instructions.map((s, idx) => (idx === i ? value : s)) }))
  }
  function addStep() { setForm((f) => ({ ...f, instructions: [...f.instructions, ''] })) }
  function removeStep(i) { setForm((f) => ({ ...f, instructions: f.instructions.filter((_, idx) => idx !== i) })) }
  function moveStep(i, dir) {
    setForm((f) => {
      const arr = [...f.instructions]
      const j = i + dir
      if (j < 0 || j >= arr.length) return f
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
      return { ...f, instructions: arr }
    })
  }

  async function handleSave() {
    if (saving) return // guard against double-taps creating duplicates
    if (!form.title.trim()) return toast('Please add a recipe name')
    const categories = (Array.isArray(form.categories) && form.categories.length)
      ? form.categories
      : [form.category || 'Dinner']
    const clean = {
      ...form,
      categories,
      category: categories[0], // keep a primary for back-compat / sorting
      servings: Number(form.servings) || 1,
      prepTime: { value: Number(form.prepTime?.value) || 0, unit: form.prepTime?.unit || 'min' },
      cookTime: { value: Number(form.cookTime?.value) || 0, unit: form.cookTime?.unit || 'min' },
      ingredients: form.ingredients
        .filter((i) => i.name.trim())
        .map((i) => ({ qty: parseQty(i.qty), unit: i.unit.trim(), name: i.name.trim() })),
      instructions: form.instructions.map((s) => s.trim()).filter(Boolean),
    }
    setSaving(true)
    setDirty(false) // clear the unsaved-changes guard before navigating
    try {
      if (isEdit) {
        await updateRecipe(id, clean)
        toast('Recipe saved')
        // Return to wherever this recipe was opened from, not just its detail
        // page — otherwise saving strands you one screen short of home.
        navigate(location.state?.from || `/recipe/${id}`)
      } else {
        await createRecipe(clean)
        localStorage.removeItem(DRAFT_KEY)
        toast('Recipe added to your library')
        // Leave the editor and return to the library.
        navigate('/recipes', { replace: true })
      }
    } catch {
      toast('Could not save recipe')
      setDirty(true)
      setSaving(false)
    }
  }

  function doCancel() {
    if (!isEdit) localStorage.removeItem(DRAFT_KEY)
    navigate(-1)
  }

  function handleCancel() {
    if (dirty) { setConfirmingDiscard(true); return }
    doCancel()
  }

  if (!loaded) return <div className="py-20 text-center text-warm-soft">Loading…</div>

  return (
    <div className="animate-fadein space-y-5 pb-10">
      {/* Sticky so Save is always reachable without scrolling to either end of
          a long recipe form. Cancels out `main`'s own top padding/margin the
          same way the hero image does, then re-applies it as its own inset. */}
      <header className="sticky top-0 z-30 -mx-4 -mt-[calc(env(safe-area-inset-top)+1.25rem)] flex items-center justify-between gap-3 border-b border-warm/10 bg-eggshell/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+1.25rem)] backdrop-blur sm:-mx-8 sm:-mt-5 sm:px-8 sm:pt-5">
        <button onClick={handleCancel} className="font-bold text-warm-soft" disabled={saving}>Cancel</button>
        <h1 className="text-lg font-extrabold">{isEdit ? 'Edit Recipe' : 'New Recipe'}</h1>
        <button onClick={handleSave} className="btn-peach px-4 py-2 text-sm disabled:opacity-60" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </header>

      <Field label="Recipe name">
        <input className="input" value={form.title} onChange={(e) => set('title', e.target.value)}
          placeholder="Grandma's lasagna" />
      </Field>

      <Field label="Photo">
        {/* Choose from the camera roll (or take a photo on mobile). The image is
            downscaled to a compact data URL stored on the recipe. */}
        <label className="btn-ghost w-full cursor-pointer">
          <CameraIcon className="h-5 w-5 text-zinc-800" />
          {uploadingPhoto ? 'Uploading…' : form.imageUrl ? 'Change photo' : 'Choose from camera roll'}
          <input type="file" accept="image/*" className="hidden" disabled={uploadingPhoto}
            onChange={(e) => handlePhotoFile(e.target.files?.[0])} />
        </label>
        <input className="input mt-2" value={(form.imageUrl || '').startsWith('data:') ? '' : (form.imageUrl || '')}
          onChange={(e) => set('imageUrl', e.target.value)}
          placeholder="…or paste an image URL" />
        {form.imageUrl && (
          <div className="relative mt-2">
            <img src={form.imageUrl} alt="preview" className="h-40 w-full rounded-2xl object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none' }} />
            <button type="button" onClick={() => set('imageUrl', '')}
              className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-1 text-xs font-bold text-warm shadow-card">
              Remove
            </button>
          </div>
        )}
      </Field>

      <Field label="Categories">
        <p className="mb-2 text-xs text-warm-soft">Pick one or more — e.g. a dish can be both Snacks and Lunch.</p>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const active = (form.categories || [form.category]).includes(c)
            return (
              // Border + shadow on both states so an unselected category still
              // reads as a chip against the eggshell page, not as one that was
              // removed. Matches CategoryFilter.
              <button key={c} type="button" onClick={() => toggleCategory(c)}
                aria-pressed={active}
                className={`rounded-full border px-4 py-2 text-sm font-bold shadow-card transition ${
                  active
                    ? 'border-peach-dark bg-peach text-warm'
                    : 'border-warm/15 bg-white text-warm-soft hover:bg-eggshell'
                }`}>{active ? '✓ ' : ''}{c}</button>
            )
          })}
        </div>
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <TimeField label="Prep" t={form.prepTime} onChange={(t) => set('prepTime', t)} />
        <TimeField label="Cook" t={form.cookTime} onChange={(t) => set('cookTime', t)} />
        <Field label="Servings">
          <input type="number" min="1" className="input" value={form.servings}
            onChange={(e) => set('servings', e.target.value)} />
        </Field>
      </div>

      {/* Ingredients */}
      <Field label="Ingredients">
        <div className="space-y-2">
          {form.ingredients.map((ing, i) => (
            <div key={i} className="flex gap-2">
              <input className="input w-16 px-2 text-center" placeholder="Qty" value={ing.qty}
                onChange={(e) => setIngredient(i, 'qty', e.target.value)} />
              <input className="input w-20 px-2" placeholder="unit" value={ing.unit}
                onChange={(e) => setIngredient(i, 'unit', e.target.value)} />
              <input className="input flex-1" placeholder="ingredient" value={ing.name}
                onChange={(e) => setIngredient(i, 'name', e.target.value)} />
              <button onClick={() => removeIngredient(i)} className="px-2 text-warm-soft hover:text-red-600"
                aria-label="Remove">✕</button>
            </div>
          ))}
        </div>
        <button onClick={addIngredient} className="btn-ghost mt-2 w-full py-2 text-sm">+ Add ingredient</button>
      </Field>

      {/* Instructions */}
      <Field label="Instructions">
        <div className="space-y-2">
          {form.instructions.map((step, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-3 w-5 shrink-0 text-center font-extrabold text-warm-soft">{i + 1}</span>
              <textarea className="input min-h-[3rem] flex-1" rows={2} value={step}
                placeholder="Describe this step…" onChange={(e) => setStep(i, e.target.value)} />
              <div className="flex flex-col">
                <button onClick={() => moveStep(i, -1)} className="px-1 text-warm-soft" aria-label="Move up">▲</button>
                <button onClick={() => moveStep(i, 1)} className="px-1 text-warm-soft" aria-label="Move down">▼</button>
              </div>
              <button onClick={() => removeStep(i)} className="mt-2 px-1 text-warm-soft hover:text-red-600"
                aria-label="Remove">✕</button>
            </div>
          ))}
        </div>
        <button onClick={addStep} className="btn-ghost mt-2 w-full py-2 text-sm">+ Add step</button>
      </Field>

      {/* Public/private */}
      <label className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-card">
        <span className="font-bold">{form.isPublic ? 'Public' : 'Private'}
          <span className="ml-1 text-xs font-normal text-warm-soft">
            {form.isPublic ? 'visible to friends' : 'only you can see this'}
          </span>
        </span>
        <input type="checkbox" className="peer sr-only" checked={form.isPublic}
          onChange={(e) => set('isPublic', e.target.checked)} />
        <span className="relative h-7 w-12 rounded-full bg-warm/20 transition peer-checked:bg-peach-dark
          after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
      </label>

      {confirmingDiscard && (
        <ConfirmDialog
          message="Discard unsaved changes?"
          confirmLabel="Discard"
          danger
          onConfirm={() => { setConfirmingDiscard(false); doCancel() }}
          onCancel={() => setConfirmingDiscard(false)}
        />
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-bold text-warm-soft">{label}</label>
      {children}
    </div>
  )
}

function TimeField({ label, t, onChange }) {
  return (
    <Field label={label}>
      <div className="flex gap-1">
        <input type="number" min="0" inputMode="numeric" className="input w-full px-2"
          value={t.value ?? ''}
          placeholder="0"
          onChange={(e) => onChange({ ...t, value: e.target.value === '' ? '' : Number(e.target.value) })} />
        <select className="rounded-2xl border border-warm/15 bg-white px-1 text-sm font-bold"
          value={t.unit} onChange={(e) => onChange({ ...t, unit: e.target.value })}>
          <option value="min">min</option>
          <option value="hr">hr</option>
        </select>
      </div>
    </Field>
  )
}

export function AddToPantryPrompt({ onYes, onNo }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-warm/40 p-6" onClick={onNo}>
      <div className="card w-full max-w-xs space-y-4 p-6 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center text-zinc-800"><PantryIcon className="h-12 w-12" /></div>
        <h3 className="text-lg font-extrabold">Add to My Pantry?</h3>
        <p className="text-sm text-warm-soft">Keep this recipe in your favorites for quick access.</p>
        <div className="flex gap-3">
          <button onClick={onNo} className="btn-ghost flex-1">Not now</button>
          <button onClick={onYes} className="btn-peach flex-1">Yes!</button>
        </div>
      </div>
    </div>
  )
}
