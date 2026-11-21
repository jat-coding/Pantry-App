// Section-heading rows that importers sometimes hand back as ingredients:
// "Ingredients", "For the sauce", "Glaze:" -- a name with no qty and no unit.
// Mr. Roni, 2026-11-20: a bare row like that must never show on a recipe.
// The data model has no group labels, so these rows are dropped.
//
// Shared by the server import (api/_lib/recipe.js coerceRecipe) and the client
// (src/lib/recipeShape.js sanitizeRecipe). Dependency-free on purpose.

const HEADING_NAME = [
  /:\s*$/, // "Glaze:", "For the dressing:"
  /^ingredients?\b/i, // "Ingredients", "Ingredients for the sprouts"
  /^for (the )?[a-z][a-z &,'/-]*$/i, // "For the sauce", "For serving", "For garnish"
]

const MAX_HEADING_LENGTH = 40

function isBlankQty(q) {
  if (q === '' || q == null) return true
  const n = Number(q)
  return Number.isFinite(n) ? n === 0 : String(q).trim() === ''
}

export function isIngredientHeading(ing) {
  if (!ing || typeof ing !== 'object') return false
  const name = String(ing.name ?? '').trim()
  if (!name || name.length > MAX_HEADING_LENGTH) return false
  if (!isBlankQty(ing.qty)) return false
  if (String(ing.unit ?? '').trim()) return false
  // A digit in the name means a real amount the parser didn't lift out ("3-4 slices bacon").
  if (/\d/.test(name)) return false
  return HEADING_NAME.some((re) => re.test(name))
}
