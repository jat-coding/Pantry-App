// Vercel serverless function: POST /api/parse
// Body: { mode: 'text', text } | { mode: 'image', base64, mediaType }
// Returns the structured recipe JSON. The Anthropic key stays on the server.

import { parseRecipe } from './_lib/recipe.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const recipe = await parseRecipe(body)
    res.status(200).json(recipe)
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Parse failed' })
  }
}
