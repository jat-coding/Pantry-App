// Shared backend logic for the recipe-import pipeline.
//
// This module runs ONLY on the server — inside the Vercel serverless functions
// (api/parse.js, api/recipe-proxy.js) in production, and inside the Vite dev
// middleware locally. The Anthropic API key is read from process.env and is
// never sent to the browser.

import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-sonnet-4-6'

// Structured-output schema. With output_config.format the model is constrained
// to return JSON matching this shape, so we can JSON.parse the response without
// the fragile fence-stripping the old client-side code needed.
const RECIPE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    categories: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'string',
        enum: ['Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Snacks', 'Drinks', 'Sauces & Dressings'],
      },
    },
    prepTime: {
      type: 'object',
      additionalProperties: false,
      properties: {
        value: { type: 'number' },
        unit: { type: 'string', enum: ['min', 'hr'] },
      },
      required: ['value', 'unit'],
    },
    cookTime: {
      type: 'object',
      additionalProperties: false,
      properties: {
        value: { type: 'number' },
        unit: { type: 'string', enum: ['min', 'hr'] },
      },
      required: ['value', 'unit'],
    },
    servings: { type: 'number' },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          qty: { type: 'number' },
          unit: { type: 'string' },
          name: { type: 'string' },
        },
        required: ['qty', 'unit', 'name'],
      },
    },
    instructions: { type: 'array', items: { type: 'string' } },
    imageUrl: { anyOf: [{ type: 'string' }, { type: 'null' }] },
  },
  required: [
    'title', 'categories', 'prepTime', 'cookTime',
    'servings', 'ingredients', 'instructions', 'imageUrl',
  ],
}

const INSTRUCTIONS =
  'Parse this recipe into the required structured fields. If a field is unknown ' +
  'use a sensible default (0, "", or null). qty must be a number (use 0 if none). ' +
  'Use short/abbreviated units where possible (tbsp, tsp, cup, oz, lb, g, kg, ml, L). ' +
  'For weight, prefer oz and lb over grams and kilograms when the result is a ' +
  'reasonable cooking amount (e.g. 227 g -> 8 oz, 500 g -> ~1 lb); keep the metric ' +
  'unit only when converting would give an awkward value. Convert the qty to match ' +
  'whatever unit you choose. ' +
  'Clean up each ingredient name so it reads as it would in a cookbook: keep the ' +
  'food and any descriptor that matters to the dish (e.g. "boneless skinless chicken ' +
  'thighs", "large eggs", "extra-virgin olive oil", "finely diced onion"). Remove ' +
  'anything not important to cooking it — prices ($3.99, "on sale"), store or brand ' +
  'names (unless the brand is essential), aisle/package SKU codes, and other ' +
  'miscellaneous shopping notes. When unsure, keep the name as-is rather than ' +
  'dropping real information. ' +
  'For categories, choose every type that fits (e.g. a granola bar could be both ' +
  'Snacks and Breakfast); include at least one.'

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured on the server.')
  }
  return new Anthropic({ apiKey })
}

// mode: 'text'  → { text }
// mode: 'image' → { base64, mediaType }
export async function parseRecipe({ mode, text, base64, mediaType }) {
  const client = getClient()

  let content
  if (mode === 'image') {
    if (!base64) throw new Error('Missing image data.')
    content = [
      {
        type: 'image',
        source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: base64 },
      },
      { type: 'text', text: `${INSTRUCTIONS}\n\nExtract the recipe shown in this image.` },
    ]
  } else {
    if (!text) throw new Error('Missing recipe text.')
    content = `${INSTRUCTIONS}\n\nRECIPE:\n${text}`
  }

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [{ role: 'user', content }],
    output_config: { format: { type: 'json_schema', schema: RECIPE_SCHEMA } },
  })

  const raw = res.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
  return coerceRecipe(extractJson(raw))
}

// Pull a JSON object out of the model's text even if structured output wasn't
// honored and it wrapped the JSON in prose or a ```json fence.
function extractJson(text) {
  const s = String(text || '').trim()
  try {
    return JSON.parse(s)
  } catch {
    // fall through to brace-scan
  }
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(s.slice(start, end + 1))
    } catch {
      // give up — return an empty object; coerceRecipe fills safe defaults
    }
  }
  return {}
}

// Guarantee the recipe shape the client expects, so the editor can never crash
// on a null/missing field. Mirrors src/lib/recipeShape.js.
function coerceRecipe(r) {
  const o = r && typeof r === 'object' ? r : {}
  const time = (t, d) => ({
    value: Number.isFinite(Number(t?.value)) ? Number(t.value) : d,
    unit: t?.unit === 'hr' ? 'hr' : 'min',
  })
  const ingredients = Array.isArray(o.ingredients)
    ? o.ingredients.map((i) => ({
        qty: Number.isFinite(Number(i?.qty)) ? Number(i.qty) : 0,
        unit: typeof i?.unit === 'string' ? i.unit : '',
        name: typeof i?.name === 'string' ? i.name : String(i?.name ?? ''),
      })).filter((i) => i.name.trim())
    : []
  const allowed = ['Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Snacks', 'Drinks', 'Sauces & Dressings']
  const cats = [...new Set([...(Array.isArray(o.categories) ? o.categories : []), o.category])]
    .filter((c) => allowed.includes(c))
  const categories = cats.length ? cats : ['Dinner']
  return {
    title: typeof o.title === 'string' ? o.title : '',
    categories,
    category: categories[0],
    prepTime: time(o.prepTime, 0),
    cookTime: time(o.cookTime, 0),
    servings: Number.isFinite(Number(o.servings)) ? Number(o.servings) : 1,
    ingredients,
    instructions: Array.isArray(o.instructions)
      ? o.instructions.map((s) => (typeof s === 'string' ? s : String(s ?? ''))).filter(Boolean)
      : [],
    imageUrl: typeof o.imageUrl === 'string' ? o.imageUrl : '',
  }
}

// Instagram / Facebook only return the post caption (in og:description) to a
// recognized crawler UA; a normal browser UA gets a login wall. Other sites get
// a realistic browser UA.
function userAgentFor(url) {
  if (/(^|\.)(instagram\.com|facebook\.com|fb\.watch|fb\.com)/i.test(url)) {
    return 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
  }
  return 'Mozilla/5.0 (compatible; PantryBot/1.0; +https://pantry-app-nu-nine.vercel.app)'
}

// Fetch an external recipe page server-side (avoids browser CORS). Times out so
// a slow/hanging host can't wedge the import.
export async function fetchPage(url) {
  if (!url) throw new Error('Missing url')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': userAgentFor(url), 'Accept-Language': 'en-US,en;q=0.9' },
      redirect: 'follow',
      signal: controller.signal,
    })
    return await r.text()
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error('That link took too long to load.')
    throw err
  } finally {
    clearTimeout(timer)
  }
}
