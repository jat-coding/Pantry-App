// Ingredient scaling engine.
// Edit any one ingredient's quantity and every ingredient scales proportionally.

// Volume units expressed in teaspoons (the canonical small unit).
const VOLUME_IN_TSP = {
  tsp: 1,
  teaspoon: 1,
  teaspoons: 1,
  tbsp: 3,
  tablespoon: 3,
  tablespoons: 3,
  'fl oz': 6,
  cup: 48,
  cups: 48,
  pint: 96,
  pt: 96,
  quart: 192,
  qt: 192,
  gallon: 768,
  gal: 768,
}

// Ordered largest -> smallest for picking a friendly display unit.
const VOLUME_LADDER = [
  ['cup', 48],
  ['tbsp', 3],
  ['tsp', 1],
]

function normUnit(unit) {
  return (unit || '').trim().toLowerCase()
}

// Short display forms so long unit names don't overlap the ingredient name.
const UNIT_ABBR = {
  tablespoon: 'tbsp', tablespoons: 'tbsp', tbsp: 'tbsp',
  teaspoon: 'tsp', teaspoons: 'tsp', tsp: 'tsp',
  cup: 'cup', cups: 'cup',
  ounce: 'oz', ounces: 'oz', oz: 'oz', 'fl oz': 'fl oz', 'fl. oz': 'fl oz', 'fl oz.': 'fl oz',
  'fluid ounce': 'fl oz', 'fluid ounces': 'fl oz',
  pound: 'lb', pounds: 'lb', lb: 'lb', lbs: 'lb',
  gram: 'g', grams: 'g', g: 'g', kilogram: 'kg', kilograms: 'kg', kg: 'kg',
  milliliter: 'ml', milliliters: 'ml', ml: 'ml',
  liter: 'L', liters: 'L', litre: 'L', litres: 'L', l: 'L',
  pint: 'pt', pints: 'pt', quart: 'qt', quarts: 'qt', gallon: 'gal', gallons: 'gal',
  package: 'pkg', packages: 'pkg',
}

export function abbreviateUnit(unit) {
  const u = (unit || '').trim()
  return UNIT_ABBR[u.toLowerCase()] || u
}

// Units a reader can switch between, grouped by what they measure. Keys are the
// abbreviated forms `abbreviateUnit` produces; values are the size of one unit
// in the family's canonical unit (tsp for volume, gram for weight). Order is the
// order they appear in the picker.
const UNIT_FAMILIES = [
  { units: { tsp: 1, tbsp: 3, 'fl oz': 6, cup: 48, pt: 96, qt: 192, gal: 768, ml: 0.202884, L: 202.884 } },
  { units: { g: 1, kg: 1000, oz: 28.3495, lb: 453.592 } },
]

function familyFor(unit) {
  const u = abbreviateUnit(unit)
  return UNIT_FAMILIES.find((f) => u in f.units) || null
}

const VOLUME = UNIT_FAMILIES[0]
const WEIGHT = UNIT_FAMILIES[1]

// Grams per US cup, from King Arthur Baking's ingredient weight chart (vanilla
// paste from a product label: 20 g/tbsp). Lets a weighed ingredient read in
// cup/tbsp/tsp. Keys are matched as whole words against the ingredient name and
// the longest match wins, so "brown sugar" beats "sugar" and "peanut butter"
// beats "butter". A null entry means "looks like a match but isn't safely
// convertible" (kosher salt is 2x denser in one brand than another; flour
// tortillas aren't flour) -- those stay weight-only.
const GRAMS_PER_CUP = {
  butter: 227,
  'peanut butter': 270,
  sugar: 198,
  'granulated sugar': 198,
  'white sugar': 198,
  'cane sugar': 198,
  'brown sugar': 213,
  'powdered sugar': 113,
  'confectioners sugar': 113,
  'icing sugar': 113,
  'coconut sugar': 154,
  flour: 120,
  'all purpose flour': 120,
  'plain flour': 120,
  'bread flour': 120,
  'cake flour': 120,
  'whole wheat flour': 113,
  'whole wheat pastry flour': 96,
  'almond flour': 96,
  'coconut flour': 128,
  'rice flour': 142,
  'baking soda': 288,
  'baking powder': 192,
  salt: 288,
  'table salt': 288,
  cocoa: 84,
  'cocoa powder': 84,
  oats: 89,
  'rolled oats': 89,
  'old fashioned oats': 89,
  'quick oats': 89,
  'steel cut oats': 140,
  'vanilla extract': 224,
  'vanilla paste': 320,
  'vanilla bean paste': 320,
  molasses: 340,
  honey: 336,
  'maple syrup': 312,
  cornstarch: 112,
  'chocolate chips': 170,
  'chocolate chip': 170,
  'mini chocolate chips': 177,
  // Not convertible: brand/shape-dependent, or not the ingredient the word suggests.
  'kosher salt': null,
  'sea salt': null,
  'flaky salt': null,
  'flaky sea salt': null,
  'almond butter': null,
  'cashew butter': null,
  'nut butter': null,
  'apple butter': null,
  'cocoa butter': null,
  'butter beans': null,
  'butter lettuce': null,
  'flour tortilla': null,
  'flour tortillas': null,
}

function wordsOf(text) {
  return ` ${(text || '').toLowerCase().replace(/['\u2019]/g, '').replace(/[^a-z]+/g, ' ').trim()} `
}

const DENSITY_KEYS = Object.keys(GRAMS_PER_CUP).sort((a, b) => b.length - a.length)

// Grams per cup for an ingredient name, or null when it isn't in the table.
export function gramsPerCup(name) {
  const key = matchKey(DENSITY_KEYS, name)
  return key ? GRAMS_PER_CUP[key] : null
}

// Liquids a recipe saved before v1.31.1 may list in plain "oz" (the import
// prompt wrote "oz" for everything until then). Same words the import prompt in
// api/_lib/recipe.js now tags "fl oz", plus buttermilk. A plain-oz ingredient
// whose name matches reads as fl oz: an exact volume conversion, no density.
// Matched like GRAMS_PER_CUP (whole words, longest wins); null marks names that
// contain a liquid word but aren't one, so they stay weight.
const LIQUIDS = {
  milk: true,
  buttermilk: true,
  broth: true,
  stock: true,
  water: true,
  juice: true,
  oil: true,
  cream: true,
  wine: true,
  vinegar: true,
  'half and half': true,
  'cream cheese': null,
  'sour cream': null,
  'ice cream': null,
  'whipped cream': null,
  'cream of': null,
  'condensed milk': null,
  'powdered milk': null,
  'milk powder': null,
  'dry milk': null,
  'milk chocolate': null,
  'stock cube': null,
  'stock cubes': null,
  'water chestnuts': null,
  'in water': null,
  'in oil': null,
  'oil packed': null,
  'in juice': null,
}

const LIQUID_KEYS = Object.keys(LIQUIDS).sort((a, b) => b.length - a.length)

// Longest whole-word key of `keys` found in `name`, or undefined.
function matchKey(keys, name) {
  const words = wordsOf(name)
  return keys.find((k) => words.includes(` ${k} `))
}

// A name in the density table (even a not-convertible null entry) is never a
// liquid, so the weight-oz behaviour for those names can't change.
export function isLiquidName(name) {
  if (matchKey(DENSITY_KEYS, name)) return false
  const key = matchKey(LIQUID_KEYS, name)
  return key ? LIQUIDS[key] === true : false
}

// The unit the conversion code works from: plain oz of a liquid is fl oz.
function effectiveUnit(unit, name) {
  const u = abbreviateUnit(unit)
  return u === 'oz' && isLiquidName(name) ? 'fl oz' : u
}

function isWeight(unit) {
  return familyFor(unit) === WEIGHT
}

// A weighed ingredient we know the density of reads in kitchen measures too.
function weightToKitchen(unit, name) {
  return isWeight(unit) && gramsPerCup(name) != null
}

// The units a quantity can be re-expressed in. Empty for anything we can't
// convert ("clove", "pkg", no unit at all) — those stay plain text.
export function compatibleUnits(rawUnit, name) {
  const unit = effectiveUnit(rawUnit, name)
  const f = familyFor(unit)
  if (!f) return []
  const all = Object.keys(f.units)
  // A fluid-ounce ingredient lists the kitchen measures first (they're what it
  // defaults to, see defaultUnitFor), then fl oz itself and the rest. A weighed
  // ingredient in the density table gets them in front of its weight units.
  if (isFluidOunce(unit)) return [...KITCHEN_UNITS, ...all.filter((u) => !KITCHEN_UNITS.includes(u))]
  if (weightToKitchen(unit, name)) return [...KITCHEN_UNITS, ...all]
  return all
}

// Fluid ounces, and weights of ingredients in GRAMS_PER_CUP, read as
// cups/tbsp/tsp by default. Any other weight is left alone: weight and volume
// don't convert without knowing the ingredient.
const KITCHEN_UNITS = ['cup', 'tbsp', 'tsp']

export function isFluidOunce(unit) {
  return abbreviateUnit(unit) === 'fl oz'
}

// The unit an ingredient is shown in before the reader picks one: its own unit,
// except fl oz (or a weight with a known density), which becomes cup once the
// TRUE amount reaches 1/4 cup (12 tsp) or more -- 1/4 cup and 1/3 cup both
// count, the cutoff is the real quantity, not how close it happens to land to
// an exact fraction; else the larger of tbsp/tsp that reads as at least 1
// (half-unit rounded). Worked out from the recipe's own quantity, not the
// scaled one, so scaling or typing an amount never makes the unit jump.
// (2026-10-21: dropped an earlier "within 1 tsp of the fraction" guard that
// kept some amounts above 1/4 cup, like 3 fl oz = 6 tbsp, stuck in tbsp --
// his rule is the threshold itself, same as the unconditional >=1/2 cup band
// already below it, which never had that guard. CUP_EPSILON only absorbs
// density-conversion rounding noise -- e.g. 2 oz butter is a real 1/4 cup
// [half a stick] but convertQty's density math lands it at 0.2498, not
// 0.25 -- it's not a reintroduction of the old closeness tolerance, which
// was ~24x looser and forgave genuinely short amounts like 1.75 fl oz.)
const CUP_EPSILON = 0.001
export function defaultUnitFor(qty, unit, name) {
  const u = effectiveUnit(unit, name)
  if (!isFluidOunce(u) && !weightToKitchen(u, name)) return u
  const n = Number(qty)
  if (!Number.isFinite(n) || n <= 0) return 'cup'
  const cups = convertQty(n, u, 'cup', name)
  if (cups >= 0.25 - CUP_EPSILON) return 'cup'
  return ['tbsp', 'tsp'].find((k) => roundHalf(convertQty(n, u, k, name)) >= 1) || 'tsp'
}

// Nearest 0.5, never showing a positive amount as 0.
export function roundHalf(n) {
  const r = Math.round(Number(n) * 2) / 2
  return r === 0 && Number(n) > 0 ? 0.5 : r
}

// Nearest whole, quarter or third (1/4, 1/3, 1/2, 2/3, 3/4: the cups in a
// measuring set), never showing a positive amount as 0.
export function roundCup(n) {
  const x = Number(n)
  const whole = Math.floor(x)
  const [val] = closestFraction(x - whole, [[0, ''], ...CUP_FRACTIONS, [1, '']])
  const r = whole + val
  return r === 0 && x > 0 ? 0.25 : r
}

// Whether displayQtyIn rounds this pairing to kitchen measures (fl oz, or a
// weight with a known density, shown as cup/tbsp/tsp).
export function isKitchenRounded(from, to, name) {
  return (isFluidOunce(effectiveUnit(from, name)) || weightToKitchen(from, name)) && KITCHEN_UNITS.includes(abbreviateUnit(to))
}

// A quantity as the reader sees it in `to`: fl oz or a weight re-expressed as
// cup is rounded to the nearest quarter/third, as tbsp/tsp to the nearest half
// (no "0.899 cup"); everything else keeps 2 decimals. Display only -- grocery
// math uses convertQty's full precision.
export function displayQtyIn(qty, from, to, name) {
  const n = Number(convertQty(qty, from, to, name))
  if (!Number.isFinite(n)) return qty
  if (isKitchenRounded(from, to, name)) return abbreviateUnit(to) === 'cup' ? roundCup(n) : roundHalf(n)
  return Math.round(n * 100) / 100
}

// Re-express a quantity in another unit of the same family, or between weight
// and volume when the ingredient's density is known (grams -> cups -> unit).
// Returns qty untouched if either side is unknown or they measure different
// things with no density to bridge them.
export function convertQty(qty, from, to, name) {
  const n = Number(qty)
  if (!Number.isFinite(n)) return qty
  const a = effectiveUnit(from, name)
  const b = effectiveUnit(to, name)
  const f = familyFor(a)
  const t = familyFor(b)
  if (!f || !t) return qty
  if (f === t) return round((n * f.units[a]) / t.units[b], 4)
  const density = gramsPerCup(name)
  if (density == null) return qty
  const tspPerCup = VOLUME.units.cup
  if (f === WEIGHT) return round(((n * f.units[a]) / density) * tspPerCup / t.units[b], 4)
  return round(((n * f.units[a]) / tspPerCup) * density / t.units[b], 4)
}

// Unicode fraction glyphs people paste or type.
const GLYPH_FRACTIONS = {
  '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75,
  '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875, '⅕': 0.2, '⅖': 0.4,
}

// Parse a quantity a user typed into a number, accepting fractions:
// "1/2" -> 0.5, "1 1/2" -> 1.5, "½" -> 0.5, "1 ½" -> 1.5, "0.75" -> 0.75.
// Returns '' for blank/unparseable so callers can keep "no quantity".
export function parseQty(input) {
  if (typeof input === 'number') return input
  let s = String(input ?? '').trim()
  if (s === '') return ''
  // Replace any glyph fractions with their decimal, spaced from a leading whole.
  for (const [g, v] of Object.entries(GLYPH_FRACTIONS)) {
    if (s.includes(g)) s = s.replace(g, ` ${v}`).trim()
  }
  // "1 1/2" (mixed) or "1 0.5" (whole + glyph-derived decimal)
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/)
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3])
  const wholePlus = s.match(/^(\d+)\s+(\d*\.?\d+)$/)
  if (wholePlus) return Number(wholePlus[1]) + Number(wholePlus[2])
  // plain fraction "3/4"
  const frac = s.match(/^(\d+)\/(\d+)$/)
  if (frac) return Number(frac[1]) / Number(frac[2])
  const n = Number(s)
  return Number.isFinite(n) ? n : ''
}

// Compute the scale factor from one edited ingredient.
export function factorFromEdit(originalQty, newQty) {
  const o = Number(originalQty)
  const n = Number(newQty)
  if (!o || !n || o <= 0) return 1
  return n / o
}

// Apply a factor to a list of {qty, unit, name} originals.
// Returns new array with scaled qty (raw numbers, not yet formatted).
export function scaleIngredients(originals, factor) {
  return originals.map((ing) => ({
    ...ing,
    qty: ing.qty == null || ing.qty === '' ? ing.qty : round(Number(ing.qty) * factor, 4),
  }))
}

function round(n, places = 2) {
  const p = Math.pow(10, places)
  return Math.round(n * p) / p
}

// Smart unit conversion for display, e.g. 0.5 tbsp -> 1.5 tsp.
// Only "downshifts" volume units when the quantity is awkwardly small (<1)
// so we don't turn "2 cups" into "32 tbsp".
export function displayUnit(qty, unit) {
  const q = Number(qty)
  const u = normUnit(unit)
  if (!Number.isFinite(q) || q <= 0 || !(u in VOLUME_IN_TSP)) {
    return { qty, unit }
  }
  let tsp = q * VOLUME_IN_TSP[u]
  for (const [name, size] of VOLUME_LADDER) {
    const val = tsp / size
    // Pick the largest unit that gives a value >= 1 (or fall through to tsp).
    if (val >= 1 || name === 'tsp') {
      return { qty: round(val, 3), unit: name }
    }
  }
  return { qty, unit }
}

// Format a number as a friendly fraction string: 0.666 -> "2/3", 1.5 -> "1 1/2".
export function formatQty(value) {
  if (value === '' || value == null) return ''
  const n = Number(value)
  if (!Number.isFinite(n)) return String(value)
  if (n === 0) return '0'

  const whole = Math.floor(n)
  const frac = n - whole
  const fracStr = nearestFraction(frac)

  if (!fracStr) return String(round(n, 2))
  if (whole === 0) return fracStr
  return `${whole} ${fracStr}`
}

const COMMON_FRACTIONS = [
  [1 / 8, '1/8'],
  [1 / 4, '1/4'],
  [1 / 3, '1/3'],
  [3 / 8, '3/8'],
  [1 / 2, '1/2'],
  [5 / 8, '5/8'],
  [2 / 3, '2/3'],
  [3 / 4, '3/4'],
  [7 / 8, '7/8'],
]

// The subset of COMMON_FRACTIONS a cup amount snaps to: quarters and thirds.
const CUP_FRACTIONS = COMMON_FRACTIONS.filter(([val]) => Number.isInteger(val * 4) || Number.isInteger(val * 3))

// The [value, label] entry in `fractions` closest to `frac`.
function closestFraction(frac, fractions) {
  let best = fractions[0]
  for (const entry of fractions) {
    if (Math.abs(frac - entry[0]) < Math.abs(frac - best[0])) best = entry
  }
  return best
}

function nearestFraction(frac) {
  if (frac < 0.06) return ''       // round down to whole
  if (frac > 0.94) return ''       // caller should treat as next whole
  return closestFraction(frac, COMMON_FRACTIONS)[1]
}

// Convenience: format an ingredient for display (qty + smart unit).
export function formatIngredient(ing) {
  const { qty, unit } = displayUnit(ing.qty, ing.unit)
  const qStr = formatQty(qty)
  return { qtyLabel: qStr, unit, name: ing.name }
}
