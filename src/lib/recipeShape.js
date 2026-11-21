// Guarantees a recipe object has the exact shape the editor and cards expect.
//
// Imported recipes (Claude paste/photo, JSON-LD, video) can come back with
// missing fields, nulls, or wrong types. The editor does `ingredients.map`,
// `instructions.map`, and reads `prepTime.value` / `cookTime.unit` directly, so
// a null/!array there throws during render → blank white screen. Normalizing
// here makes the editor crash-proof no matter what the importer returned.

import { CATEGORIES } from './categories.js'
import { cleanStepLinks, keepMap, remapStepLinks } from './stepLinks.js'
import { isIngredientHeading } from '../../api/_lib/ingredientHeading.js'
import { blankZeroQty, cleanIngredientName, cleanStep, isStepHeading, liftAmountFromName } from '../../api/_lib/recipeText.js'

// Only a real web link is kept as a recipe's source; anything else is dropped.
function asSourceUrl(u) {
  return typeof u === 'string' && /^https?:\/\/\S+$/i.test(u.trim()) ? u.trim() : ''
}

function asTime(t, fallbackValue) {
  const unit = t && (t.unit === 'hr' || t.unit === 'min') ? t.unit : 'min'
  const value = t && Number.isFinite(Number(t.value)) ? Number(t.value) : fallbackValue
  return { value, unit }
}

function asIngredient(ing) {
  if (!ing || typeof ing !== 'object') return { qty: '', unit: '', name: String(ing ?? '') }
  const qty = ing.qty === '' || ing.qty == null ? '' : Number(ing.qty)
  // Same cleanup the importers apply (audit 2026-11-20): qty 0 shows blank, entities,
  // prices and broken "(, note)" parens go, and an amount stuck in the name is lifted out.
  return liftAmountFromName({
    qty: Number.isFinite(qty) ? blankZeroQty(qty) : '',
    unit: typeof ing.unit === 'string' ? ing.unit : '',
    name: cleanIngredientName(typeof ing.name === 'string' ? ing.name : String(ing.name ?? '')),
  })
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
  const rawIngredients = Array.isArray(r.ingredients) ? r.ingredients.map(asIngredient) : []
  // Section-heading rows ("Ingredients", "For the sauce") never show; drop them and
  // re-point step links past them below.
  const ingredients = rawIngredients.filter((i) => !isIngredientHeading(i))
  const rawSteps = Array.isArray(r.instructions)
    ? r.instructions.map((s) => cleanStep(typeof s === 'string' ? s : String(s ?? '')))
    : []
  // Empty steps and "Instructions"/"Directions" heading steps are dropped.
  const keepStep = (s) => Boolean(s) && !isStepHeading(s)
  const instructions = rawSteps.filter(keepStep)
  // Manual step -> ingredient picks are keyed by step position, so re-point them past
  // any empty steps dropped just above. Recipes saved before they existed get {}.
  const stepIngredientLinks = remapStepLinks(
    cleanStepLinks(r.stepIngredientLinks, rawSteps.length, rawIngredients.length),
    keepMap(rawSteps, keepStep),
    keepMap(rawIngredients, (i) => !isIngredientHeading(i)),
  )

  return {
    ...r,
    title: typeof r.title === 'string' ? r.title : '',
    imageUrl: typeof r.imageUrl === 'string' ? r.imageUrl : '',
    videoUrl: typeof r.videoUrl === 'string' ? r.videoUrl : '',
    sourceUrl: asSourceUrl(r.sourceUrl),
    category,
    categories,
    prepTime: asTime(r.prepTime, 0),
    cookTime: asTime(r.cookTime, 0),
    servings: Number.isFinite(Number(r.servings)) && Number(r.servings) > 0 ? Number(r.servings) : 1,
    ingredients: ingredients.length ? ingredients : [{ qty: '', unit: '', name: '' }],
    instructions: instructions.length ? instructions : [''],
    stepIngredientLinks,
    isPublic: !!r.isPublic,
  }
}
