// Deterministic text cleanup for imported recipes, shared by the server import
// (api/_lib/recipe.js coerceRecipe), the JSON-LD import (src/lib/jsonld.js), the
// editor load (src/lib/recipeShape.js) and the saved-recipe repair script.
// Dependency-free on purpose (runs in Node and the browser).
//
// Mr. Roni, 2026-11-20 recipe audit: every problem below was found on real saved
// recipes (HTML entities, "($0.99)" prices, "(, finely chopped)", "((Note 3))",
// an "Instructions" heading saved as a step, and qty 0 showing as "0").

const NAMED_ENTITIES = {
  nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', ndash: '–', mdash: '—',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', deg: '°', frac12: '½',
  frac14: '¼', frac34: '¾', times: '×', reg: '', trade: '', copy: '',
}

// "&nbsp;" / "&#39;" / "&#x2019;" -> characters, and drop any stray HTML tags.
export function decodeHtml(s) {
  let out = String(s ?? '')
  // Two passes catch double-encoded text ("&amp;nbsp;").
  for (let pass = 0; pass < 2; pass++) {
    out = out
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&([a-z]+\d*);/gi, (m, name) => (name.toLowerCase() in NAMED_ENTITIES ? NAMED_ENTITIES[name.toLowerCase()] : m))
  }
  return out.replace(/<[^>]{1,200}>/g, ' ').replace(/ /g, ' ')
}

// Remove the "(" at `open` and its matching ")".
function dropParenPair(s, open) {
  let depth = 0
  for (let i = open; i < s.length; i++) {
    if (s[i] === '(') depth++
    else if (s[i] === ')') {
      depth--
      if (depth === 0) return s.slice(0, open) + s.slice(open + 1, i) + s.slice(i + 1)
    }
  }
  return s.slice(0, open) + s.slice(open + 1) // unmatched: just drop the "("
}

export function cleanIngredientName(name) {
  let s = decodeHtml(name).replace(/\s+/g, ' ').trim()
  // Shopping prices: "cooked rice ($0.99)".
  s = s.replace(/\s*\(\s*\$\s?\d+(?:\.\d+)?\s*\)/g, '')
  // Footnote references: "((Note 3))", "(note 2)", "(see note)".
  s = s.replace(/\s*\(+\s*(?:see\s+)?notes?(?:\s*\d+)?\s*\)+/gi, '')
  // A note that opens with a comma: "coriander (, finely chopped)" -> "coriander, finely chopped".
  for (let guard = 0; guard < 10; guard++) {
    const i = s.search(/\(\s*,/)
    if (i < 0) break
    s = dropParenPair(s, i)
  }
  // Doubled parens: "((2 large lemons))" -> "(2 large lemons)"; "((or 1 cube" -> "(or 1 cube".
  for (let guard = 0; guard < 10 && /\(\(([^()]*)\)\)/.test(s); guard++) s = s.replace(/\(\(([^()]*)\)\)/g, '($1)')
  s = s.replace(/\(\(/g, '(').replace(/\)\)(?=\s*$)/, ')')
  // Balance anything still open: "(or 1 cube crumbled" -> "(or 1 cube crumbled)".
  const open = (s.match(/\(/g) || []).length - (s.match(/\)/g) || []).length
  if (open > 0) s += ')'.repeat(open)
  s = s.replace(/\(\s*\)/g, '') // empty "()"
  s = s.replace(/\s+,/g, ',').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')
  s = s.replace(/\*+(?=\s|$|,)/g, '') // footnote asterisks: "taco seasoning*"
  return s.replace(/\s+/g, ' ').replace(/[\s,;]+$/, '').trim()
}

// Headings and page furniture that importers hand back as a "step".
const STEP_HEADING = /^(instructions?|directions?|method|steps?|preparation|prep|how to make( it| this)?|to make|nutrition( facts| information| info)?|notes?|recipe notes|tips?|equipment|ingredients?)\s*:?$/i

export function isStepHeading(step) {
  const s = String(step ?? '').trim()
  if (!s) return false
  if (STEP_HEADING.test(s)) return true
  // "For the glaze:" / "Assembly:" -- short, ends with a colon, no sentence in it.
  return s.length <= 40 && /:\s*$/.test(s) && !/[.!?]/.test(s)
}

// One step's text: entities decoded, spaces collapsed, leading "1." / "Step 2:" removed.
export function cleanStep(step) {
  return decodeHtml(step)
    .replace(/[ \t]+/g, ' ')
    .replace(/^\s*(?:step\s*\d+\s*[:.)-]?|\d+\s*[.)]|\d+\s*:)\s+/i, '')
    .trim()
}

// qty 0 means "no amount" everywhere it came from (the import schema forces a
// number, so "salt, to taste" arrived as 0); a blank qty shows nothing instead of "0".
export function blankZeroQty(q) {
  if (q === '' || q == null) return ''
  const n = Number(q)
  return Number.isFinite(n) && n !== 0 ? n : ''
}

// Ingredient string -> {qty, unit, name}
const UNITS = ['cup', 'cups', 'c', 'tbsp', 'tbs', 'tbsps', 'tablespoon', 'tablespoons', 'tsp', 'tsps',
  'teaspoon', 'teaspoons', 'oz', 'ounce', 'ounces', 'lb', 'lbs', 'pound', 'pounds', 'g', 'gram', 'grams',
  'kg', 'kilogram', 'kilograms', 'ml', 'milliliter', 'milliliters', 'l', 'liter', 'liters', 'litre', 'litres',
  'pt', 'pint', 'pints', 'qt', 'quart', 'quarts', 'gal', 'gallon', 'gallons',
  'clove', 'cloves', 'pinch', 'pinches', 'dash', 'dashes', 'can', 'cans', 'jar', 'jars', 'slice', 'slices',
  'stick', 'sticks', 'package', 'packages', 'pkg', 'bunch', 'bunches', 'sprig', 'sprigs', 'head', 'heads']

// Long unit words -> the short forms the rest of the app uses ("c." -> cup).
const UNIT_SHORT = {
  c: 'cup', cups: 'cup', tbs: 'tbsp', tbsps: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  tsps: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp', ounce: 'oz', ounces: 'oz', pound: 'lb', pounds: 'lb',
  lbs: 'lb', gram: 'g', grams: 'g', kilogram: 'kg', kilograms: 'kg', milliliter: 'ml', milliliters: 'ml',
  l: 'L', liter: 'L', liters: 'L', litre: 'L', litres: 'L', pint: 'pt', pints: 'pt', quart: 'qt',
  quarts: 'qt', gallon: 'gal', gallons: 'gal',
}

const FRACTION_MAP = { '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875 }

const num = (t) => {
  if (/^\d+\/\d+$/.test(t)) { const [a, b] = t.split('/'); return Number(b) ? Number(a) / Number(b) : null }
  if (/^\d*\.?\d+$/.test(t)) return Number(t)
  return null
}

function unitAt(tokens, idx) {
  const two = `${tokens[idx] || ''} ${tokens[idx + 1] || ''}`.toLowerCase().replace(/\./g, '')
  if (/^(fl|fluid) (oz|ounce|ounces)$/.test(two)) return { unit: 'fl oz', used: 2 }
  const t = (tokens[idx] || '').toLowerCase().replace(/\.$/, '')
  if (t && UNITS.includes(t)) {
    return { unit: UNIT_SHORT[t] || t, used: 1 }
  }
  return null
}

export function parseIngredientLine(line) {
  const original = cleanIngredientName(line)
  let s = original
  // "1½" -> "1 0.5", "½" -> "0.5"; every glyph, not just the first.
  for (const [glyph, val] of Object.entries(FRACTION_MAP)) s = s.split(glyph).join(` ${val} `)
  // A range "3-4" / "3 – 4" / "3 to 4": use the low end, keep the high end as a note.
  let upTo = ''
  s = s.replace(/^\s*(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?)\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?)(?=\s|$)/i, (_, a, b) => { upTo = b; return a })
  const tokens = s.trim().split(/\s+/).filter(Boolean)
  let idx = 0
  let acc = 0
  let matched = false
  while (idx < tokens.length) {
    const n = num(tokens[idx])
    if (n == null) break
    acc += n
    matched = true
    idx++
  }
  const qty = matched ? Math.round(acc * 1000) / 1000 : ''
  let unit = ''
  const u = matched ? unitAt(tokens, idx) : null
  if (u) { unit = u.unit; idx += u.used }
  // "1 (15 oz) can black beans" / "1 15oz. can black beans": the size is a note, the can is the unit.
  if (matched && !unit) {
    const size = tokens.slice(idx).join(' ').match(/^\(?(\d+(?:\.\d+)?)\s*-?\s*(oz|ounce|g|ml)\.?\)?\s+(can|cans|jar|jars|package|packages|bag|box|carton)\b\s*(.*)$/i)
    if (size) {
      const rest = size[4].trim()
      return { qty, unit: size[3].toLowerCase(), name: cleanIngredientName(`${rest} (${size[1]} ${size[2].toLowerCase()})`) }
    }
  }
  let name = cleanIngredientName(tokens.slice(idx).join(' '))
  if (upTo && name) name = `${name} (up to ${upTo})`
  return { qty, unit, name: name || original }
}

// A row whose amount never got lifted out of its name ("0.5 cup plain Greek yogurt",
// "3-4 slices bacon", "c. whole milk"): parse the name again. Rows that already have
// a unit, or whose name doesn't start with an amount, come back unchanged.
export function liftAmountFromName(ing) {
  const qty = blankZeroQty(ing.qty)
  const unit = String(ing.unit ?? '').trim()
  const name = cleanIngredientName(ing.name)
  if (!unit && qty === '' && /^(\d|[½⅓⅔¼¾⅛⅜⅝⅞])/.test(name)) {
    const p = parseIngredientLine(name)
    if (p.qty !== '' && p.name) return { ...ing, qty: p.qty, unit: p.unit, name: p.name }
  }
  // qty set, unit word left on the front of the name: 2 | '' | 'c. stuffing mix'.
  if (!unit && qty !== '') {
    // 1 | '' | '15oz. can black beans' -> 1 can black beans (15 oz).
    if (/^\(?\d+(?:\.\d+)?\s*-?\s*(?:oz|ounce|g|ml)\.?\)?\s+(?:can|cans|jar|jars|package|packages|bag|box|carton)\b/i.test(name)) {
      const p = parseIngredientLine(`1 ${name}`)
      if (p.unit) return { ...ing, qty, unit: p.unit, name: p.name }
    }
    const tokens = name.split(/\s+/)
    const u = unitAt(tokens, 0)
    if (u && tokens.length > u.used) return { ...ing, qty, unit: u.unit, name: tokens.slice(u.used).join(' ') }
  }
  return { ...ing, qty, unit, name }
}
