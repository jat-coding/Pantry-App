import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useData } from '../contexts/DataContext.jsx'
import { useToast } from '../components/Toast.jsx'
import { CATEGORIES } from '../lib/categories.js'
import { PantryIcon, CameraIcon } from '../components/icons.jsx'

// Downscale a chosen photo to a compact JPEG data URL so it fits in Firestore
// (no Storage bucket yet). Keeps the longest edge <= 1000px.
function fileToScaledDataUrl(file, maxEdge = 1000, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

const DRAFT_KEY = 'pantry-draft-new'

function blankRecipe() {
  return {
    title: '',
    imageUrl: '',
    category: 'Dinner',
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
  const { recipes, getRecipe, createRecipe, updateRecipe } = useData()
  const toast = useToast()

  const [form, setForm] = useState(blankRecipe)
  const [dirty, setDirty] = useState(false)
  const [loaded, setLoaded] = useState(!isEdit)
  const [saving, setSaving] = useState(false)
  const initial = useRef(true)

  // Load existing recipe (edit) or restore draft (new).
  useEffect(() => {
    if (isEdit) {
      const live = recipes.find((r) => r.id === id)
      const apply = (r) => {
        if (r) setForm({ ...blankRecipe(), ...r })
        setLoaded(true)
      }
      live ? apply(live) : getRecipe(id).then(apply)
    } else {
      const saved = localStorage.getItem(DRAFT_KEY)
      if (saved) {
        try { setForm({ ...blankRecipe(), ...JSON.parse(saved) }) } catch {}
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

  async function handlePhotoFile(file) {
    if (!file) return
    try {
      const dataUrl = await fileToScaledDataUrl(file)
      set('imageUrl', dataUrl)
    } catch {
      toast('Could not load that photo')
    }
  }

  function setIngredient(i, key, value) {
    setForm((f) => {
      const ingredients = f.ingredients.map((ing, idx) =>
        idx === i ? { ...ing, [key]: key === 'qty' ? value : value } : ing)
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
    const clean = {
      ...form,
      servings: Number(form.servings) || 1,
      ingredients: form.ingredients
        .filter((i) => i.name.trim())
        .map((i) => ({ qty: i.qty === '' ? '' : Number(i.qty), unit: i.unit.trim(), name: i.name.trim() })),
      instructions: form.instructions.map((s) => s.trim()).filter(Boolean),
    }
    setSaving(true)
    setDirty(false) // clear the unsaved-changes guard before navigating
    try {
      if (isEdit) {
        await updateRecipe(id, clean)
        toast('Recipe saved')
        navigate(`/recipe/${id}`)
      } else {
        const newId = await createRecipe(clean)
        localStorage.removeItem(DRAFT_KEY)
        // Leave the editor and open the new recipe, prompting to add to pantry.
        navigate(`/recipe/${newId}`, { state: { promptPantry: true } })
      }
    } catch {
      toast('Could not save recipe')
      setDirty(true)
      setSaving(false)
    }
  }

  function handleCancel() {
    if (dirty && !window.confirm('Discard unsaved changes?')) return
    if (!isEdit) localStorage.removeItem(DRAFT_KEY)
    navigate(-1)
  }

  if (!loaded) return <div className="py-20 text-center text-warm-soft">Loading…</div>

  return (
    <div className="animate-fadein space-y-5 pb-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">{isEdit ? 'Edit Recipe' : 'New Recipe'}</h1>
        <button onClick={handleCancel} className="font-bold text-warm-soft">Cancel</button>
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
          {form.imageUrl ? 'Change photo' : 'Choose from camera roll'}
          <input type="file" accept="image/*" className="hidden"
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

      <Field label="Category">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => set('category', c)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                form.category === c ? 'bg-peach text-warm shadow-card' : 'bg-white text-warm-soft'
              }`}>{c}</button>
          ))}
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

      <div className="flex gap-3">
        <button onClick={handleCancel} className="btn-ghost flex-1" disabled={saving}>Cancel</button>
        <button onClick={handleSave} className="btn-peach flex-1 disabled:opacity-60" disabled={saving}>
          {saving ? 'Saving…' : 'Save Recipe'}
        </button>
      </div>
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
        <input type="number" min="0" className="input w-full px-2" value={t.value}
          onChange={(e) => onChange({ ...t, value: Number(e.target.value) })} />
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
