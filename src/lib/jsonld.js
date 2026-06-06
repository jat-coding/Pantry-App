// Extract a Schema.org Recipe from a page's <script type="application/ld+json"> blocks
// and map it to our internal recipe shape.

function parseDuration(iso) {
  // ISO 8601 duration like PT1H30M -> { value, unit }
  if (!iso || typeof iso !== 'string') return { value: 0, unit: 'min' }
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/)
  if (!m) return { value: 0, unit: 'min' }
  const h = Number(m[1] || 0)
  const min = Number(m[2] || 0)
  const total = h * 60 + min
  if (total >= 60 && total % 60 === 0) return { value: total / 60, unit: 'hr' }
  return { value: total, unit: 'min' }
}

function asArray(x) {
  if (!x) return []
  return Array.isArray(x) ? x : [x]
}

function flattenInstructions(ri) {
  const out = []
  for (const step of asArray(ri)) {
    if (typeof step === 'string') out.push(step)
    else if (step?.text) out.push(step.text)
    else if (step?.itemListElement) out.push(...flattenInstructions(step.itemListElement))
  }
  return out.map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean)
}

// Naive ingredient string -> {qty, unit, name}
const UNITS = ['cup', 'cups', 'tbsp', 'tablespoon', 'tablespoons', 'tsp', 'teaspoon', 'teaspoons',
  'oz', 'ounce', 'ounces', 'lb', 'lbs', 'pound', 'pounds', 'g', 'gram', 'grams', 'kg', 'ml', 'l',
  'clove', 'cloves', 'pinch', 'can', 'cans', 'slice', 'slices']

const FRACTION_MAP = { '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅛': 0.125 }

export function parseIngredientLine(line) {
  let s = line.trim()
  for (const [glyph, val] of Object.entries(FRACTION_MAP)) s = s.replace(glyph, ` ${val}`)
  const tokens = s.split(/\s+/)
  let qty = ''
  let idx = 0
  // qty may be "1", "1/2", or "1 1/2"
  const num = (t) => {
    if (/^\d+\/\d+$/.test(t)) { const [a, b] = t.split('/'); return Number(a) / Number(b) }
    if (/^\d*\.?\d+$/.test(t)) return Number(t)
    return null
  }
  let acc = 0
  let matched = false
  while (idx < tokens.length) {
    const n = num(tokens[idx])
    if (n == null) break
    acc += n
    matched = true
    idx++
  }
  if (matched) qty = Math.round(acc * 100) / 100
  let unit = ''
  if (tokens[idx] && UNITS.includes(tokens[idx].toLowerCase().replace(/\.$/, ''))) {
    unit = tokens[idx].replace(/\.$/, '')
    idx++
  }
  const name = tokens.slice(idx).join(' ')
  return { qty, unit, name: name || line.trim() }
}

function mapCategory(c) {
  const allowed = ['Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Snacks', 'Drinks']
  const raw = asArray(c)[0]
  if (!raw) return 'Dinner'
  const hit = allowed.find((a) => raw.toLowerCase().includes(a.toLowerCase()))
  return hit || 'Dinner'
}

export function extractRecipeFromHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const scripts = [...doc.querySelectorAll('script[type="application/ld+json"]')]
  let recipeNode = null
  for (const s of scripts) {
    let json
    try { json = JSON.parse(s.textContent) } catch { continue }
    const nodes = []
    const collect = (n) => {
      if (!n) return
      if (Array.isArray(n)) return n.forEach(collect)
      if (n['@graph']) n['@graph'].forEach(collect)
      nodes.push(n)
    }
    collect(json)
    recipeNode = nodes.find((n) => asArray(n['@type']).map(String).some((t) => t.toLowerCase() === 'recipe'))
    if (recipeNode) break
  }
  if (!recipeNode) return null

  const img = recipeNode.image
  const imageUrl = typeof img === 'string' ? img : asArray(img)[0]?.url || asArray(img)[0] || ''
  const yieldVal = asArray(recipeNode.recipeYield)[0]
  const servings = parseInt(String(yieldVal).match(/\d+/)?.[0] || '4', 10)

  return {
    title: recipeNode.name || 'Imported recipe',
    category: mapCategory(recipeNode.recipeCategory),
    imageUrl: typeof imageUrl === 'string' ? imageUrl : '',
    prepTime: parseDuration(recipeNode.prepTime),
    cookTime: parseDuration(recipeNode.cookTime),
    servings: Number.isFinite(servings) ? servings : 4,
    ingredients: asArray(recipeNode.recipeIngredient).map(parseIngredientLine),
    instructions: flattenInstructions(recipeNode.recipeInstructions),
  }
}
