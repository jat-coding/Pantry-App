// Manual step -> ingredient links (src/lib/stepLinks.js): they are stored by array
// position, so every delete/reorder/save-time blank drop must re-point them.
// Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  cleanStepLinks, remapStepLinks, keepMap, toggleStepLink, clearStepLink, explicitStepLink,
  linksAfterRemoveIngredient, linksAfterRemoveStep, linksAfterSwapSteps,
} from '../src/lib/stepLinks.js'
import { sanitizeRecipe } from '../src/lib/recipeShape.js'
import { stepIngredientIndexes } from '../src/lib/stepIngredients.js'

// The same steps RecipeEditor.jsx runs, in the same order.
const editor = {
  removeIngredient: (f, i) => ({
    ...f,
    ingredients: f.ingredients.filter((_, idx) => idx !== i),
    stepIngredientLinks: linksAfterRemoveIngredient(f.stepIngredientLinks, i),
  }),
  removeStep: (f, i) => ({
    ...f,
    instructions: f.instructions.filter((_, idx) => idx !== i),
    stepIngredientLinks: linksAfterRemoveStep(f.stepIngredientLinks, i),
  }),
  moveStep: (f, i, dir) => {
    const arr = [...f.instructions]
    const j = i + dir
    if (j < 0 || j >= arr.length) return f
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    return { ...f, instructions: arr, stepIngredientLinks: linksAfterSwapSteps(f.stepIngredientLinks, i, j) }
  },
  current: (f, i) => explicitStepLink(f.stepIngredientLinks, i) ?? stepIngredientIndexes(f.instructions[i], f.ingredients),
  toggle: (f, i, k) => ({ ...f, stepIngredientLinks: toggleStepLink(f.stepIngredientLinks, i, k, editor.current(f, i)) }),
  save: (f) => ({
    ingredients: f.ingredients.filter((i) => i.name.trim()).map((i) => ({ ...i, name: i.name.trim() })),
    instructions: f.instructions.map((s) => s.trim()).filter(Boolean),
    stepIngredientLinks: remapStepLinks(
      f.stepIngredientLinks,
      keepMap(f.instructions, (s) => s.trim()),
      keepMap(f.ingredients, (i) => i.name.trim()),
    ),
  }),
}

// What Cook Mode (RecipeDetail.jsx) shows under step i, by ingredient name.
function cookModeNames(saved, i) {
  const links = cleanStepLinks(saved.stepIngredientLinks, saved.instructions.length, saved.ingredients.length)
  return (explicitStepLink(links, i) ?? stepIngredientIndexes(saved.instructions[i], saved.ingredients))
    .filter((k) => saved.ingredients[k].name)
    .map((k) => saved.ingredients[k].name)
}

const base = () => sanitizeRecipe({
  title: 'Banana bread',
  ingredients: [
    { qty: 2, unit: 'cups', name: 'flour' },
    { qty: 0.25, unit: 'cup', name: 'maple syrup' },
    { qty: 3, unit: '', name: 'bananas' },
  ],
  instructions: ['Preheat the oven.', 'Mix everything together.', 'Bake 50 minutes.'],
})

test('card scenario: link ingredient #2 to step #2, delete ingredient #1 and step #1', () => {
  let f = base()
  f = editor.toggle(f, 1, 1) // step 2 <- maple syrup
  assert.deepEqual(f.stepIngredientLinks, { 1: [1] })
  f = editor.removeIngredient(f, 0) // flour gone: maple syrup is now ingredient #1 (index 0)
  assert.deepEqual(f.stepIngredientLinks, { 1: [0] })
  f = editor.removeStep(f, 0) // preheat gone: "Mix everything" is now step #1 (index 0)
  assert.deepEqual(f.stepIngredientLinks, { 0: [0] })
  assert.equal(f.instructions[0], 'Mix everything together.')
  assert.equal(f.ingredients[0].name, 'maple syrup')

  const saved = editor.save(f)
  assert.deepEqual(cookModeNames(saved, 0), ['maple syrup'])
  assert.deepEqual(cookModeNames(saved, 1), []) // "Bake 50 minutes." names nothing
  // And it survives a reload through sanitizeRecipe (what the editor does on edit).
  assert.deepEqual(sanitizeRecipe(saved).stepIngredientLinks, { 0: [0] })
})

test('deleting a linked ingredient drops it; later ones shift down', () => {
  const links = { 0: [0, 1, 3], 2: [2] }
  assert.deepEqual(linksAfterRemoveIngredient(links, 1), { 0: [0, 2], 2: [1] })
})

test('deleting a step drops its links and renumbers later steps', () => {
  const links = { 0: [1], 1: [2], 3: [0] }
  assert.deepEqual(linksAfterRemoveStep(links, 1), { 0: [1], 2: [0] })
})

test('moving a step carries its links with it', () => {
  let f = base()
  f = editor.toggle(f, 0, 2) // step 1 <- bananas
  f = editor.moveStep(f, 0, 1)
  assert.equal(f.instructions[1], 'Preheat the oven.')
  assert.deepEqual(f.stepIngredientLinks, { 1: [2] })
  f = editor.moveStep(f, 1, 1)
  assert.deepEqual(f.stepIngredientLinks, { 2: [2] })
  f = editor.moveStep(f, 2, 1) // off the end: no change
  assert.deepEqual(f.stepIngredientLinks, { 2: [2] })
})

test('save drops blank rows and re-points links through both renumberings', () => {
  const f = {
    ingredients: [
      { name: '' }, { name: 'flour' }, { name: '  ' }, { name: 'maple syrup' }, { name: 'salt' },
    ],
    instructions: ['', 'Whisk.', '   ', 'Drizzle.', 'Sprinkle.'],
    // step 1 -> flour + blank row 2; step 2 is blank (dropped); step 3 -> maple syrup
    stepIngredientLinks: { 1: [1, 2], 2: [4], 3: [3] },
  }
  const saved = editor.save(f)
  assert.deepEqual(saved.instructions, ['Whisk.', 'Drizzle.', 'Sprinkle.'])
  assert.deepEqual(saved.ingredients.map((i) => i.name), ['flour', 'maple syrup', 'salt'])
  assert.deepEqual(saved.stepIngredientLinks, { 0: [0], 1: [1] })
  assert.deepEqual(cookModeNames(saved, 1), ['maple syrup'])
})

test('first tap on an auto-matched step keeps what was already showing', () => {
  let f = sanitizeRecipe({
    ingredients: [{ name: 'butter' }, { name: 'sugar' }, { name: 'maple syrup' }],
    instructions: ['Cream the butter and sugar.'],
  })
  assert.deepEqual(editor.current(f, 0), [0, 1]) // text match
  f = editor.toggle(f, 0, 2) // add maple syrup
  assert.deepEqual(f.stepIngredientLinks, { 0: [0, 1, 2] })
  f = editor.toggle(f, 0, 0) // remove butter
  assert.deepEqual(f.stepIngredientLinks, { 0: [1, 2] })
  // Untoggling everything keeps an explicit "none", and Match from text clears it.
  f = editor.toggle(editor.toggle(f, 0, 1), 0, 2)
  assert.deepEqual(f.stepIngredientLinks, { 0: [] })
  assert.deepEqual(editor.current(f, 0), [])
  f = { ...f, stepIngredientLinks: clearStepLink(f.stepIngredientLinks, 0) }
  assert.deepEqual(editor.current(f, 0), [0, 1])
})

test('a step with no link keeps text-matching; a linked one shows exactly its picks', () => {
  const saved = {
    ingredients: [{ name: 'flour' }, { name: 'maple syrup' }, { name: '' }],
    instructions: ['Whisk the flour.', 'Fold it all together.'],
    stepIngredientLinks: { 1: [1, 2] }, // index 2 has no name: filtered like today
  }
  assert.deepEqual(cookModeNames(saved, 0), ['flour'])
  assert.deepEqual(cookModeNames(saved, 1), ['maple syrup'])
})

test('old recipes and malformed links load as no links', () => {
  assert.deepEqual(base().stepIngredientLinks, {})
  const r = sanitizeRecipe({
    ingredients: [{ name: 'a' }, { name: 'b' }],
    instructions: ['one', 'two'],
    stepIngredientLinks: { 0: [1, 1, 9, -1, 'x', 0.5], 5: [0], foo: [0], '01': [0], 1: 'nope' },
  })
  assert.deepEqual(r.stepIngredientLinks, { 0: [1] })
  assert.deepEqual(sanitizeRecipe({ stepIngredientLinks: [1, 2] }).stepIngredientLinks, {})
  assert.deepEqual(sanitizeRecipe({ stepIngredientLinks: null }).stepIngredientLinks, {})
})

test('sanitize re-points links past empty steps it drops on load', () => {
  const r = sanitizeRecipe({
    ingredients: [{ name: 'a' }, { name: 'b' }],
    instructions: ['', 'two', '', 'four'],
    stepIngredientLinks: { 0: [0], 1: [1], 3: [0, 1] },
  })
  assert.deepEqual(r.instructions, ['two', 'four'])
  assert.deepEqual(r.stepIngredientLinks, { 0: [1], 1: [0, 1] })
})
