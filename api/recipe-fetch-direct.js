// Vercel serverless function: POST /api/recipe-fetch-direct
// Body: { url } -> { html, via: 'direct' }
// Fetches a recipe page straight from this function, no home bridge involved. Used by
// the client when the bridge path breaks mid-job, and by the hourly probe to check the
// fallback path on its own (bridge/scripts/pantry-import-check.sh in the agent repo).
import { fetchPageDirect, BLOCKED_ERROR } from './_lib/directFetch.js'

export const config = { maxDuration: 25 }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  let url = ''
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    url = (body.url || '').trim()
  } catch {
    res.status(400).json({ error: 'Bad request body' })
    return
  }
  if (!url) {
    res.status(400).json({ error: 'Missing url' })
    return
  }
  const r = await fetchPageDirect(url, { deadlineMs: 20_000 })
  if (r.ok) {
    res.status(200).json({ html: r.html, via: 'direct', attempts: r.attempts })
    return
  }
  res.status(r.error === BLOCKED_ERROR ? 400 : 502).json({ error: r.error, via: 'direct', attempts: r.attempts })
}
