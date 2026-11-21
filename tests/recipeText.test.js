// Root causes from the 2026-11-20 audit of every saved recipe on Mr. Roni's account.
// Each input below is a real row that was saved wrong. Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanIngredientName, cleanStep, decodeHtml, isStepHeading, liftAmountFromName, parseIngredientLine } from '../api/_lib/recipeText.js'
import { coerceRecipe } from '../api/_lib/recipe.js'
import { sanitizeRecipe } from '../src/lib/recipeShape.js'
import { repairRecipe } from '../scripts/recipe-repair.mjs'

test('JSON-LD: a leading fraction glyph is the qty, not part of the name', () => {
  assert.deepEqual(parseIngredientLine('½ cup plain Greek yogurt'), { qty: 0.5, unit: 'cup', name: 'plain Greek yogurt' })
  assert.deepEqual(parseIngredientLine('⅛ teaspoon fine sea salt'), { qty: 0.125, unit: 'tsp', name: 'fine sea salt' })
  assert.deepEqual(parseIngredientLine('1½ cups flour'), { qty: 1.5, unit: 'cup', name: 'flour' })
})

test('JSON-LD: "c." is cup, long units are shortened, ranges use the low end', () => {
  assert.deepEqual(parseIngredientLine('2 c. store-bought stuffing mix'), { qty: 2, unit: 'cup', name: 'store-bought stuffing mix' })
  assert.deepEqual(parseIngredientLine('1 pound Brussels sprouts'), { qty: 1, unit: 'lb', name: 'Brussels sprouts' })
  assert.deepEqual(parseIngredientLine('3-4 slices bacon'), { qty: 3, unit: 'slices', name: 'bacon (up to 4)' })
  assert.deepEqual(parseIngredientLine('1 15oz. can black beans'), { qty: 1, unit: 'can', name: 'black beans (15 oz)' })
  assert.deepEqual(parseIngredientLine('2 large eggs'), { qty: 2, unit: '', name: 'large eggs' })
  assert.deepEqual(parseIngredientLine('Zest of 1 large lemon'), { qty: '', unit: '', name: 'Zest of 1 large lemon' })
})

test('names: entities, prices, comma-notes, doubled parens, note refs', () => {
  assert.equal(cleanIngredientName('honey&nbsp;'), 'honey')
  assert.equal(cleanIngredientName('cooked rice ($0.99)'), 'cooked rice')
  assert.equal(cleanIngredientName('taco seasoning* ($0.67)'), 'taco seasoning')
  assert.equal(cleanIngredientName('coriander (, finely chopped)'), 'coriander, finely chopped')
  assert.equal(cleanIngredientName('parsley (, finely chopped (or mint))'), 'parsley, finely chopped (or mint)')
  assert.equal(cleanIngredientName('vegetable stock powder ((or 1 cube crumbled'), 'vegetable stock powder (or 1 cube crumbled)')
  assert.equal(cleanIngredientName('fresh lemon juice ((2 large lemons))'), 'fresh lemon juice (2 large lemons)')
  assert.equal(cleanIngredientName('jar sun dried tomato strips in OIL ((Note 3))'), 'jar sun dried tomato strips in OIL')
  assert.equal(cleanIngredientName('cayenne pepper (optional)'), 'cayenne pepper (optional)')
  assert.equal(cleanIngredientName("Frank's RedHot"), "Frank's RedHot")
})

test('steps: headings dropped, numbering and entities stripped, real steps untouched', () => {
  for (const s of ['Instructions', 'Directions:', 'Method', 'Nutrition Facts', 'For the glaze:']) assert.equal(isStepHeading(s), true, s)
  for (const s of ['Preheat the oven to 400°F.', 'Optional: add cheese on top.', 'Serve immediately and enjoy!']) assert.equal(isStepHeading(s), false, s)
  assert.equal(cleanStep('1. Preheat the oven.'), 'Preheat the oven.')
  assert.equal(cleanStep('Step 2: Mix well.'), 'Mix well.')
  assert.equal(cleanStep('2 eggs go in next.'), '2 eggs go in next.')
  assert.equal(cleanStep('1.5 cups of stock go in.'), '1.5 cups of stock go in.')
  assert.equal(cleanStep('green onions).&nbsp;'), 'green onions).')
  assert.equal(decodeHtml('Mac &amp; cheese &#39;n&#x2019; more'), "Mac & cheese 'n’ more")
})

test('qty 0 ("salt, to taste") is stored blank, not shown as "0"', () => {
  const r = coerceRecipe({ ingredients: [{ qty: 0, unit: '', name: 'fresh basil, for garnish' }, { qty: 2, unit: 'cup', name: 'broth' }] })
  assert.equal(r.ingredients[0].qty, '')
  assert.equal(r.ingredients[1].qty, 2)
  assert.equal(sanitizeRecipe({ ingredients: [{ qty: 0, unit: 'to taste', name: 'salt' }] }).ingredients[0].qty, '')
})

test('server import: qty stuck in name is lifted, Instructions heading step dropped', () => {
  const r = coerceRecipe({
    ingredients: [{ qty: 0, unit: '', name: '0.5 cup plain Greek yogurt' }, { qty: 2, unit: '', name: 'c. whole milk' }],
    instructions: ['Instructions', '1. Mix.', 'Bake.&nbsp;'],
  })
  assert.deepEqual(r.ingredients, [{ qty: 0.5, unit: 'cup', name: 'plain Greek yogurt' }, { qty: 2, unit: 'cup', name: 'whole milk' }])
  assert.deepEqual(r.instructions, ['Mix.', 'Bake.'])
})

test('editor load: heading step dropped and step links re-pointed', () => {
  const r = sanitizeRecipe({ ingredients: [{ qty: 1, unit: 'lb', name: 'sprouts' }], instructions: ['Instructions', 'Roast.'], stepIngredientLinks: { 1: [0] } })
  assert.deepEqual(r.instructions, ['Roast.'])
  assert.deepEqual(r.stepIngredientLinks, { 0: [0] })
})

test('liftAmountFromName leaves good rows alone', () => {
  const rows = [{ qty: 2, unit: '', name: 'large eggs' }, { qty: 1, unit: '', name: 'stalk celery' }, { qty: '', unit: '', name: 'Kosher salt' }]
  for (const row of rows) assert.deepEqual(liftAmountFromName(row), row)
  assert.deepEqual(liftAmountFromName({ qty: 1, unit: '', name: '15oz. can black beans ($0.59)' }), { qty: 1, unit: 'can', name: 'black beans (15 oz)' })
})

test('repair: fixes the real saved shapes, keeps links, and is idempotent', () => {
  const saved = {
    ingredients: [
      { qty: '', unit: '', name: '0.5 cup plain Greek yogurt' },
      { qty: 0, unit: '', name: 'fresh basil, for garnish' },
      { qty: 2, unit: '', name: 'c. store-bought stuffing mix' },
      { qty: 1, unit: 'Cup', name: 'Olive oil' },
    ],
    instructions: ['Instructions', 'Mix the yogurt.', 'Add basil.&nbsp;\n\nThen the oil.'],
    stepIngredientLinks: { 1: [0], 2: [1, 3] },
  }
  const once = repairRecipe(saved)
  assert.deepEqual(once.ingredients, [
    { qty: 0.5, unit: 'cup', name: 'plain Greek yogurt' },
    { qty: '', unit: '', name: 'fresh basil, for garnish' },
    { qty: 2, unit: 'cup', name: 'store-bought stuffing mix' },
    { qty: 1, unit: 'Cup', name: 'Olive oil' },
  ])
  assert.deepEqual(once.instructions, ['Mix the yogurt.', 'Add basil.', 'Then the oil.'])
  assert.deepEqual(once.stepIngredientLinks, { 0: [0], 1: [1, 3] })
  const twice = repairRecipe({ ...saved, ...once })
  assert.deepEqual(twice, once)
})
