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
  ounce: 'oz', ounces: 'oz', oz: 'oz', 'fl oz': 'fl oz',
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

function nearestFraction(frac) {
  if (frac < 0.06) return ''       // round down to whole
  if (frac > 0.94) return ''       // caller should treat as next whole
  let best = ''
  let bestDiff = Infinity
  for (const [val, str] of COMMON_FRACTIONS) {
    const d = Math.abs(frac - val)
    if (d < bestDiff) {
      bestDiff = d
      best = str
    }
  }
  return best
}

// Convenience: format an ingredient for display (qty + smart unit).
export function formatIngredient(ing) {
  const { qty, unit } = displayUnit(ing.qty, ing.unit)
  const qStr = formatQty(qty)
  return { qtyLabel: qStr, unit, name: ing.name }
}
