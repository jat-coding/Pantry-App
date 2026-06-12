// Vercel serverless function: GET /api/recipe-proxy?url=<encoded>
// Fetches an external recipe page server-side and streams the HTML back,
// avoiding browser CORS restrictions during URL import.

import { fetchPage } from './_lib/recipe.js'

export const config = { maxDuration: 30 }

export default async function handler(req, res) {
  const url = req.query?.url
  if (!url) {
    res.status(400).send('Missing url param')
    return
  }
  try {
    const html = await fetchPage(url)
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.status(200).send(html)
  } catch (err) {
    res.status(502).send('Fetch failed: ' + (err?.message || 'unknown error'))
  }
}
