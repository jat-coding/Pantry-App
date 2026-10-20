// Unit-conversion checks for src/lib/scaling.js. Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compatibleUnits, defaultUnitFor, convertQty, displayQtyIn, gramsPerCup } from '../src/lib/scaling.js'

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
  // 10 oz flour = 283.5 g / 120 = 2.36 cup -> 2.5
  assert.equal(displayQtyIn(10, 'oz', 'cup', 'flour'), 2.5)
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
