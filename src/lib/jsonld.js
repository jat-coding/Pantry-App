// Extract a Schema.org Recipe from a page's <script type="application/ld+json"> blocks
// and map it to our internal recipe shape.

import { cleanStep, decodeHtml, isStepHeading, parseIngredientLine } from '../../api/_lib/recipeText.js'

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
  // Entities decoded, numbering stripped, and "Instructions"-style heading steps dropped.
  return out.map((s) => cleanStep(s).replace(/\s+/g, ' ')).filter((s) => s && !isStepHeading(s))
}

// The line parser lives with the other shared cleanup so the server import uses it too.
export { parseIngredientLine }

function decodeTitle(t) {
  return typeof t === 'string' ? decodeHtml(t).replace(/\s+/g, ' ').trim() : ''
}

function mapCategories(c) {
  const allowed = ['Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Snacks', 'Drinks', 'Sauces & Dressings']
  const hits = new Set()
  for (const raw of asArray(c)) {
    if (typeof raw !== 'string') continue
    const lc = raw.toLowerCase()
    for (const a of allowed) if (lc.includes(a.toLowerCase())) hits.add(a)
  }
  return hits.size ? [...hits] : ['Dinner']
}

import { normalizeImageUrl } from './imageUrl.js'

export function extractRecipeFromHtml(html, pageUrl) {
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

  const imageUrl = normalizeImageUrl(recipeNode.image, pageUrl)
    || normalizeImageUrl(doc.querySelector('meta[property="og:image"]')?.getAttribute('content'), pageUrl)
  const yieldVal = asArray(recipeNode.recipeYield)[0]
  const servings = parseInt(String(yieldVal).match(/\d+/)?.[0] || '4', 10)

  const categories = mapCategories(recipeNode.recipeCategory)
  return {
    title: decodeTitle(recipeNode.name) || 'Imported recipe',
    categories,
    category: categories[0],
    imageUrl,
    prepTime: parseDuration(recipeNode.prepTime),
    cookTime: parseDuration(recipeNode.cookTime),
    servings: Number.isFinite(servings) ? servings : 4,
    ingredients: asArray(recipeNode.recipeIngredient).filter((l) => typeof l === 'string').map(parseIngredientLine).filter((i) => i.name),
    instructions: flattenInstructions(recipeNode.recipeInstructions),
    sourceUrl: pageUrl || '',
  }
}
