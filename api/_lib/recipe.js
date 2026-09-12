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
  'thighs", "large eggs", "extra-virgin olive oil", "finely diced onion"). The name ' +
  'must be ONLY the fundamental ingredient plus a cooking-relevant descriptor — never ' +
  'where to buy it or what it was bought as. Strip: prices ($3.99, "on sale", "$5 off"), ' +
  'store/chain names ("from Trader Joe\'s", "Costco-size"), brand names (unless the ' +
  'brand is essential to the dish, e.g. "Frank\'s RedHot"), aisle/SKU/package codes, ' +
  'and any other shopping/sponsorship note. When unsure whether text is a real cooking ' +
  'descriptor or shopping noise, drop it — a slightly shorter ingredient name is better ' +
  'than one with checkout-line clutter in it. ' +
  'Instructions must read like a normal cookbook method, one clear action per step. ' +
  'This content sometimes comes from a video transcript or social caption, which carries ' +
  'noise a cookbook never has — strip ALL of it rather than transcribing it verbatim: ' +
  'transcript/caption artifacts in brackets ([MUSIC PLAYING], [BLANK_AUDIO], [Applause], ' +
  'speaker labels); timestamps (00:00, 1:23); filler and false starts from speech ("um", ' +
  '"uh", "so yeah", stutters/repeated words); social-media noise (hashtags, @mentions, ' +
  'decorative emoji, "like and subscribe", "link in bio", "follow for more", promo codes); ' +
  'and stray bullet/arrow symbols left over from captions. Never invent a step that ' +
  'wasn\'t in the source — only remove noise, don\'t add content. ' +
  'For categories, choose every type that fits (e.g. a granola bar could be both ' +
  'Snacks and Breakfast); include at least one.'

// Whisper's own transcript conventions leak into instructions verbatim often enough
// (every video-mode transcript in testing had at least one) that this is worth a
// deterministic backstop rather than trusting the model's compliance alone — same
// principle as coerceRecipe() guaranteeing shape, just for known-junk text instead.
const TRANSCRIPT_ARTIFACT = /\[[A-Z][A-Z _]*\]/g
function stripTranscriptArtifacts(s) {
  return String(s ?? '').replace(TRANSCRIPT_ARTIFACT, '').replace(/\s{2,}/g, ' ').trim()
}

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured on the server.')
  }
  return new Anthropic({ apiKey })
}

// mode: 'text'  → { text }
// mode: 'image' → { base64, mediaType }
// mode: 'pdf'   → { base64 }
// mode: 'video' → { text: transcript, images: [{ base64, mediaType }] }
export async function parseRecipe({ mode, text, base64, mediaType, images }) {
  const client = getClient()

  let content
  if (mode === 'video') {
    if (!text && !(images || []).length) throw new Error('Missing video transcript/frames.')
    // Spoken audio and on-screen text (ingredient lists, step captions) are two
    // independent sources for the same recipe — hand Claude both rather than
    // picking one, since a video only rarely writes out the full method in
    // just its dialogue.
    content = [
      ...(images || []).map((img) => ({
        type: 'image',
        source: { type: 'base64', media_type: img.mediaType || 'image/jpeg', data: img.base64 },
      })),
      {
        type: 'text',
        text: `${INSTRUCTIONS}\n\nExtract the recipe from this cooking video. You are given ` +
          `frames sampled across the video plus its spoken audio, transcribed below (may be ` +
          `empty, incomplete, or contain misheard words — cross-check it against the frames, ` +
          `which often show the actual ingredient list or steps as on-screen text).\n\n` +
          `TRANSCRIPT:\n${text || '(no speech detected)'}`,
      },
    ]
  } else if (mode === 'pdf') {
    if (!base64) throw new Error('Missing PDF data.')
    // Claude reads the PDF directly — both its text layer and the page images,
    // so scanned cookbook pages work as well as digital ones.
    content = [
      {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64 },
      },
      { type: 'text', text: `${INSTRUCTIONS}\n\nExtract the recipe from this document. If it contains several recipes, extract the first complete one.` },
    ]
  } else if (mode === 'image') {
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
      ? o.instructions
          .map((s) => stripTranscriptArtifacts(typeof s === 'string' ? s : String(s ?? '')))
          .filter(Boolean)
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
