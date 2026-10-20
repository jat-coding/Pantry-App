// Unit-conversion checks for src/lib/scaling.js. Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compatibleUnits, defaultUnitFor, convertQty, displayQtyIn, gramsPerCup, roundCup, formatQty, isLiquidName, isKitchenRounded } from '../src/lib/scaling.js'

const OZ = 28.3495

test('weighed ingredient in the density table offers cup/tbsp/tsp first', () => {
  assert.deepEqual(compatibleUnits('oz', 'brown sugar'), ['cup', 'tbsp', 'tsp', 'g', 'kg', 'oz', 'lb'])
  assert.deepEqual(compatibleUnits('g', 'softened unsalted butter').slice(0, 3), ['cup', 'tbsp', 'tsp'])
})

test('unknown ingredient stays weight-only', () => {
  assert.deepEqual(compatibleUnits('oz', 'banana'), ['g', 'kg', 'oz', 'lb'])
  assert.equal(defaultUnitFor(4, 'oz', 'banana'), 'oz')
  assert.equal(convertQty(4, 'oz', 'cup', 'banana'), 4)
  assert.deepEqual(compatibleUnits('oz'), ['g', 'kg', 'oz', 'lb'])
})

test('longest match wins and false friends stay weight-only', () => {
  assert.equal(gramsPerCup('dark brown sugar, packed'), 213)
  assert.equal(gramsPerCup('granulated sugar'), 198)
  assert.equal(gramsPerCup('Confectioners’ sugar'), 113)
  assert.equal(gramsPerCup('all-purpose flour'), 120)
  assert.equal(gramsPerCup('creamy peanut butter'), 270)
  assert.equal(gramsPerCup('buttermilk'), null)
  assert.equal(gramsPerCup('kosher salt'), null)
  assert.equal(gramsPerCup('flour tortillas'), null)
  assert.equal(gramsPerCup('salted butter'), 227)
})

test('7.88 oz brown sugar defaults to 1 cup', () => {
  // 7.88 oz = 223.39 g; / 213 g per cup = 1.0488 cup -> rounds to 1
  assert.equal(defaultUnitFor(7.88, 'oz', 'brown sugar'), 'cup')
  assert.equal(convertQty(7.88, 'oz', 'cup', 'brown sugar'), 1.0488)
  assert.equal(displayQtyIn(7.88, 'oz', 'cup', 'brown sugar'), 1)
})

test('cookie recipe weights land on sane kitchen measures', () => {
  // 8 oz butter = 226.8 g = 1 cup (2 sticks)
  assert.equal(defaultUnitFor(8, 'oz', 'unsalted butter'), 'cup')
  assert.equal(displayQtyIn(8, 'oz', 'cup', 'unsalted butter'), 1)
  // 1 oz baking soda... small amounts: 0.21 oz = 5.95 g = ~1 tsp (6 g/tsp)
  assert.equal(defaultUnitFor(0.21, 'oz', 'baking soda'), 'tsp')
  assert.equal(displayQtyIn(0.21, 'oz', 'tsp', 'baking soda'), 1)
  // 10 oz flour = 283.5 g / 120 = 2.36 cup -> 2 1/3 (was 2.5 under nearest-half)
  assert.equal(formatQty(displayQtyIn(10, 'oz', 'cup', 'flour')), '2 1/3')
  // 0.5 oz vanilla paste = 14.17 g; 20 g/tbsp -> 0.71 tbsp, 2.13 tsp -> tsp, shown 2
  assert.equal(defaultUnitFor(0.5, 'oz', 'vanilla paste'), 'tsp')
  assert.equal(displayQtyIn(0.5, 'oz', 'tsp', 'vanilla paste'), 2)
})

test('kitchen -> weight goes back through the same density (typed edits)', () => {
  // 1 cup brown sugar = 213 g = 7.5134 oz
  assert.equal(convertQty(1, 'cup', 'oz', 'brown sugar'), Math.round((213 / OZ) * 1e4) / 1e4)
  const there = convertQty(3, 'oz', 'tbsp', 'butter')
  assert.ok(Math.abs(convertQty(there, 'tbsp', 'oz', 'butter') - 3) < 0.001)
  // grams stay exact: 1 tbsp butter = 227/16 g
  assert.equal(convertQty(1, 'tbsp', 'g', 'butter'), 14.1875)
})

test('fl oz and same-family conversion unchanged', () => {
  assert.equal(defaultUnitFor(8, 'fl oz'), 'cup')
  assert.equal(defaultUnitFor(1.5, 'fl oz'), 'tbsp')
  assert.equal(displayQtyIn(0.3, 'fl oz', 'tsp'), 2)
  assert.equal(convertQty(6, 'oz', 'g'), 170.097)
  assert.equal(convertQty(1, 'cup', 'tbsp'), 16)
  assert.equal(convertQty(1, 'clove', 'g', 'butter'), 1)
})

test('cups snap to quarters and thirds; tbsp/tsp stay half-rounded', () => {
  // 6 oz butter = 170.1 g / 227 = 0.749 cup -> 3/4 cup, not 12 tbsp
  assert.equal(defaultUnitFor(6, 'oz', 'softened unsalted butter'), 'cup')
  assert.equal(displayQtyIn(6, 'oz', 'cup', 'softened unsalted butter'), 0.75)
  assert.equal(formatQty(displayQtyIn(6, 'oz', 'cup', 'butter')), '3/4')
  // 2.4 oz white sugar = 68 g / 198 = 0.34 cup -> 1/3 cup
  assert.equal(formatQty(displayQtyIn(2.4, 'oz', 'cup', 'white sugar')), '1/3')
  // 5.33 fl oz = 2/3 cup; 1.25 cup reads 1 1/4
  assert.equal(formatQty(displayQtyIn(5.33, 'fl oz', 'cup')), '2/3')
  assert.equal(formatQty(displayQtyIn(10, 'fl oz', 'cup')), '1 1/4')
  assert.equal(roundCup(0.01), 0.25)
  assert.equal(roundCup(2.1), 2)
  // tbsp keeps nearest half: 5.5 tbsp, not a fraction snap
  assert.equal(displayQtyIn(2.4, 'oz', 'tbsp', 'white sugar'), 5.5)
  // whole/half cases from earlier rounds unchanged
  assert.equal(defaultUnitFor(8, 'fl oz'), 'cup')
  assert.equal(defaultUnitFor(1.5, 'fl oz'), 'tbsp')
  assert.equal(displayQtyIn(1.5, 'fl oz', 'tbsp'), 3)
  assert.equal(defaultUnitFor(0.3, 'fl oz'), 'tsp')
  assert.equal(displayQtyIn(7.88, 'oz', 'cup', 'brown sugar'), 1)
  // same-family volume rows picked as cup keep 2 decimals (not kitchen-rounded)
  assert.equal(displayQtyIn(5, 'tbsp', 'cup'), 0.31)
})

test('plain-oz liquids (pre-v1.31.1 imports) read as fl oz', () => {
  // 8 oz milk = 8 fl oz = 1 cup, exactly the fl oz path
  assert.equal(defaultUnitFor(8, 'oz', 'whole milk'), 'cup')
  assert.equal(displayQtyIn(8, 'oz', 'cup', 'whole milk'), 1)
  assert.deepEqual(compatibleUnits('oz', 'milk'), compatibleUnits('fl oz'))
  assert.equal(defaultUnitFor(1.5, 'oz', 'olive oil'), 'tbsp')
  assert.equal(displayQtyIn(1.5, 'oz', 'tbsp', 'olive oil'), 3)
  assert.equal(defaultUnitFor(0.3, 'oz', 'lemon juice'), 'tsp')
  assert.equal(formatQty(displayQtyIn(32, 'oz', 'cup', 'low-sodium chicken broth')), '4')
  assert.equal(convertQty(3, 'oz', 'cup', 'chicken stock'), convertQty(3, 'fl oz', 'cup'))
  assert.equal(convertQty(1, 'cup', 'oz', 'heavy cream'), 8)
  assert.ok(isKitchenRounded('oz', 'cup', 'dry white wine'))
  for (const n of ['water', 'red wine vinegar', 'half-and-half', 'coconut milk', 'Ounces of vegetable oil']) assert.equal(isLiquidName(n), true, n)
  assert.equal(defaultUnitFor(12, 'ounces', 'buttermilk'), 'cup')
})

test('buttermilk is a liquid, butter stays in the density table', () => {
  assert.equal(isLiquidName('buttermilk'), true)
  assert.equal(gramsPerCup('buttermilk'), null)
  assert.equal(displayQtyIn(6, 'oz', 'cup', 'buttermilk'), 0.75) // 6 fl oz = 3/4 cup
  assert.equal(isLiquidName('unsalted butter'), false)
  assert.equal(displayQtyIn(6, 'oz', 'cup', 'butter'), 0.75) // 170.1 g / 227 by density
  assert.equal(convertQty(6, 'oz', 'g', 'butter'), 170.097) // still weight oz
})

test('false friends with a liquid word stay weight', () => {
  for (const n of ['cream cheese, softened', 'sour cream', 'cream of tartar', 'cream of mushroom soup', 'sweetened condensed milk',
    'milk chocolate, chopped', 'milk chocolate chips', 'water chestnuts', 'tuna in oil', 'oil-packed sun-dried tomatoes', 'creamy peanut butter', 'ice cream'])
    assert.equal(isLiquidName(n), false, n)
  assert.deepEqual(compatibleUnits('oz', 'cream cheese'), ['g', 'kg', 'oz', 'lb'])
  assert.equal(defaultUnitFor(8, 'oz', 'cream cheese'), 'oz')
  assert.equal(convertQty(8, 'oz', 'g', 'cream cheese'), 226.796)
  // density-table liquids keep their density, never the fl oz shortcut
  for (const n of ['maple syrup', 'honey', 'molasses', 'vanilla extract']) assert.equal(isLiquidName(n), false, n)
  assert.equal(displayQtyIn(7.88, 'oz', 'cup', 'brown sugar'), 1)
})

test('only plain oz is relabelled, other units of a liquid are untouched', () => {
  assert.deepEqual(compatibleUnits('g', 'milk'), ['g', 'kg', 'oz', 'lb'])
  assert.equal(defaultUnitFor(200, 'g', 'milk'), 'g')
  assert.equal(defaultUnitFor(1, 'lb', 'water'), 'lb')
  assert.equal(defaultUnitFor(2, 'cup', 'milk'), 'cup')
  assert.equal(defaultUnitFor(8, 'fl oz', 'milk'), 'cup')
})

test('cup is the default from 1/4 cup, only when the 1/4 or 1/3 reading is within 1 tsp', () => {
  // 2.4 oz white sugar = 0.3434 cup (16.48 tsp); 1/3 cup = 16 tsp, 0.48 tsp off -> cup (was 5.5 tbsp)
  assert.equal(defaultUnitFor(2.4, 'oz', 'white sugar'), 'cup')
  // 2 fl oz = 12 tsp = exactly 1/4 cup (was 4 tbsp); 2.7 fl oz = 16.2 tsp -> 1/3 cup (was 5.5 tbsp)
  assert.equal(defaultUnitFor(2, 'fl oz'), 'cup')
  assert.equal(formatQty(displayQtyIn(2, 'fl oz', 'cup')), '1/4')
  assert.equal(defaultUnitFor(2.7, 'oz', 'whole milk'), 'cup')
  assert.equal(formatQty(displayQtyIn(2.7, 'oz', 'cup', 'whole milk')), '1/3')
  // 2 oz butter (half a stick) = 0.2498 cup -> 1/4 cup (was 4 tbsp)
  assert.equal(defaultUnitFor(2, 'oz', 'unsalted butter'), 'cup')
  assert.equal(formatQty(displayQtyIn(2, 'oz', 'cup', 'unsalted butter')), '1/4')
})

test('the 1 tsp guard keeps amounts a 1/4 or 1/3 cup would misstate in tbsp/tsp', () => {
  // 1.5 fl oz = 9 tsp; 1/4 cup would be 12 tsp, 3 tsp (33%) too much -> stays exactly 3 tbsp
  assert.equal(defaultUnitFor(1.5, 'fl oz'), 'tbsp')
  assert.equal(displayQtyIn(1.5, 'fl oz', 'tbsp'), 3)
  assert.equal(defaultUnitFor(1.5, 'oz', 'olive oil'), 'tbsp')
  // 1.75 fl oz = 10.5 tsp, 1.5 tsp under 1/4 cup -> 3.5 tbsp
  assert.equal(defaultUnitFor(1.75, 'fl oz'), 'tbsp')
  assert.equal(displayQtyIn(1.75, 'fl oz', 'tbsp'), 3.5)
  // 3 fl oz = 18 tsp, 2 tsp over 1/3 cup -> 6 tbsp
  assert.equal(defaultUnitFor(3, 'fl oz'), 'tbsp')
  // 2.5 oz white sugar = 0.358 cup (17.18 tsp), 1.18 tsp over 1/3 cup -> 5.5 tbsp
  assert.equal(defaultUnitFor(2.5, 'oz', 'white sugar'), 'tbsp')
  // tiny amounts roundCup lifts to 1/4 cup are far off it -> tsp
  assert.equal(defaultUnitFor(0.21, 'oz', 'baking soda'), 'tsp')
  assert.equal(defaultUnitFor(0.5, 'oz', 'vanilla paste'), 'tsp')
  assert.equal(defaultUnitFor(0.3, 'fl oz'), 'tsp')
  // the guard is only for the new 1/4-1/2 cup band: 7.88 oz brown sugar is
  // 2.3 tsp off 1 cup and still defaults to cup, as before
  assert.equal(defaultUnitFor(7.88, 'oz', 'brown sugar'), 'cup')
  assert.equal(defaultUnitFor(6, 'oz', 'butter'), 'cup')
})
