// Section-heading rows ("Ingredients", "For the X", "Glaze:") must never survive an
// import or a load into the editor. Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isIngredientHeading } from '../api/_lib/ingredientHeading.js'
import { coerceRecipe } from '../api/_lib/recipe.js'
import { sanitizeRecipe } from '../src/lib/recipeShape.js'
import { parseIngredientLine } from '../src/lib/jsonld.js'

// The shape the Brussels sprouts import came back as: a bare "Ingredients" row first.
const brussels = () => ({
  title: 'Crispy Brussels Sprouts with Bacon',
  ingredients: [
    { qty: 0, unit: '', name: 'Ingredients' },
    { qty: 1, unit: 'lb', name: 'Brussels sprouts, halved' },
    { qty: 0, unit: '', name: '3-4 slices bacon' },
    { qty: 2, unit: 'tbsp', name: 'olive oil' },
    { qty: 0, unit: '', name: 'For the glaze:' },
    { qty: 1, unit: 'tbsp', name: 'balsamic vinegar' },
    { qty: 0, unit: '', name: 'salt and pepper to taste' },
  ],
  instructions: ['Crisp the bacon.', 'Roast the sprouts in the oil.', 'Toss with balsamic.'],
})

const names = (r) => r.ingredients.map((i) => i.name)
const expected = [
  'Brussels sprouts, halved', 'bacon (up to 4)', 'olive oil',
  'balsamic vinegar', 'salt and pepper to taste',
]

test('isIngredientHeading: headings vs real qty-less items', () => {
  for (const name of ['Ingredients', 'Ingredients:', 'For the sauce', 'For the glaze:', 'For serving', 'Topping:', 'ingredients for the sprouts']) {
    assert.equal(isIngredientHeading({ qty: 0, unit: '', name }), true, name)
    assert.equal(isIngredientHeading({ qty: '', unit: '', name }), true, name)
  }
  for (const name of ['3-4 slices bacon', 'salt and pepper to taste', 'fresh parsley', 'Brussels sprouts', 'lemon wedges, for serving']) {
    assert.equal(isIngredientHeading({ qty: 0, unit: '', name }), false, name)
  }
  // A qty or unit makes it a real item even with a heading-ish name.
  assert.equal(isIngredientHeading({ qty: 1, unit: '', name: 'Ingredients' }), false)
  assert.equal(isIngredientHeading({ qty: 0, unit: 'cup', name: 'For the sauce' }), false)
})

test('server coerceRecipe drops the Brussels sprouts heading rows', () => {
  assert.deepEqual(names(coerceRecipe(brussels())), expected)
})

test('client sanitizeRecipe drops heading rows and keeps step links pointing at the same items', () => {
  // Saved links by old index: step 0 -> bacon (2), step 1 -> sprouts (1) + oil (3),
  // step 2 -> balsamic (5) and the glaze heading (4), which must vanish.
  const r = sanitizeRecipe({ ...brussels(), stepIngredientLinks: { 0: [2], 1: [1, 3], 2: [4, 5] } })
  assert.deepEqual(names(r), expected)
  const linked = (s) => r.stepIngredientLinks[s].map((k) => r.ingredients[k].name)
  assert.deepEqual(linked(0), ['bacon (up to 4)'])
  assert.deepEqual(linked(1), ['Brussels sprouts, halved', 'olive oil'])
  assert.deepEqual(linked(2), ['balsamic vinegar'])
})

test('JSON-LD lines -> sanitizeRecipe drops "Ingredients" / "For the X" lines', () => {
  const lines = ['Ingredients', '1 lb Brussels sprouts', '3-4 slices bacon', 'For the dressing:', '2 tbsp honey']
  const r = sanitizeRecipe({ ingredients: lines.map(parseIngredientLine), instructions: ['Cook.'] })
  assert.deepEqual(names(r), ['Brussels sprouts', 'bacon (up to 4)', 'honey'])
})
