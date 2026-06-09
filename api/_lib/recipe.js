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
    category: {
      type: 'string',
      enum: ['Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Snacks', 'Drinks', 'Sauces & Dressings'],
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
    'title', 'category', 'prepTime', 'cookTime',
    'servings', 'ingredients', 'instructions', 'imageUrl',
  ],
}

const INSTRUCTIONS =
  'Parse this recipe into the required structured fields. If a field is unknown ' +
  'use a sensible default (0, "", or null). qty must be a number (use 0 if none). ' +
  'Use short/abbreviated units where possible (tbsp, tsp, cup, oz, lb, g, kg, ml, L).'

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

  const json = res.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
  return JSON.parse(json)
}

// Fetch an external recipe page server-side (avoids browser CORS).
export async function fetchPage(url) {
  if (!url) throw new Error('Missing url')
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 PantryBot' } })
  return r.text()
}
