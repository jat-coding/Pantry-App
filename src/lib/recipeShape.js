// Guarantees a recipe object has the exact shape the editor and cards expect.
//
// Imported recipes (Claude paste/photo, JSON-LD, video) can come back with
// missing fields, nulls, or wrong types. The editor does `ingredients.map`,
// `instructions.map`, and reads `prepTime.value` / `cookTime.unit` directly, so
// a null/!array there throws during render → blank white screen. Normalizing
// here makes the editor crash-proof no matter what the importer returned.

import { CATEGORIES } from './categories.js'

function asTime(t, fallbackValue) {
  const unit = t && (t.unit === 'hr' || t.unit === 'min') ? t.unit : 'min'
  const value = t && Number.isFinite(Number(t.value)) ? Number(t.value) : fallbackValue
  return { value, unit }
}

function asIngredient(ing) {
  if (!ing || typeof ing !== 'object') return { qty: '', unit: '', name: String(ing ?? '') }
  const qty = ing.qty === '' || ing.qty == null ? '' : Number(ing.qty)
  return {
    qty: Number.isFinite(qty) ? qty : '',
    unit: typeof ing.unit === 'string' ? ing.unit : '',
    name: typeof ing.name === 'string' ? ing.name : String(ing.name ?? ''),
  }
}

// Build a clean, deduped list of valid categories from either the new array or
// a legacy single `category`. Always returns at least one.
function asCategories(r) {
  const fromArray = Array.isArray(r.categories) ? r.categories : []
  const candidates = [...fromArray, r.category].filter((c) => CATEGORIES.includes(c))
  const unique = [...new Set(candidates)]
  return unique.length ? unique : ['Dinner']
}

export function sanitizeRecipe(raw) {
  const r = raw && typeof raw === 'object' ? raw : {}
  const categories = asCategories(r)
  const category = categories[0]
  const ingredients = Array.isArray(r.ingredients) ? r.ingredients.map(asIngredient) : []
  const instructions = Array.isArray(r.instructions)
    ? r.instructions.map((s) => (typeof s === 'string' ? s : String(s ?? ''))).filter(Boolean)
    : []

  return {
    ...r,
    title: typeof r.title === 'string' ? r.title : '',
    imageUrl: typeof r.imageUrl === 'string' ? r.imageUrl : '',
    category,
    categories,
    prepTime: asTime(r.prepTime, 0),
    cookTime: asTime(r.cookTime, 0),
    servings: Number.isFinite(Number(r.servings)) && Number(r.servings) > 0 ? Number(r.servings) : 1,
    ingredients: ingredients.length ? ingredients : [{ qty: '', unit: '', name: '' }],
    instructions: instructions.length ? instructions : [''],
    isPublic: !!r.isPublic,
  }
}
