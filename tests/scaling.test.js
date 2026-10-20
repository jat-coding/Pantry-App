// Unit-conversion checks for src/lib/scaling.js. Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compatibleUnits, defaultUnitFor, convertQty, displayQtyIn, gramsPerCup, roundCup, formatQty } from '../src/lib/scaling.js'

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
  // 2.4 oz white sugar = 68 g / 198 = 0.34 cup -> 1/3 cup when cup is picked,
  // but below the 1/2-cup default threshold, so it still defaults to tbsp
  assert.equal(formatQty(displayQtyIn(2.4, 'oz', 'cup', 'white sugar')), '1/3')
  assert.equal(defaultUnitFor(2.4, 'oz', 'white sugar'), 'tbsp')
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
