// Vercel serverless function: GET /api/video-meta?url=<encoded>
// Returns a YouTube video's title + description as structured JSON, so the
// importer can hand Claude just the recipe text instead of a whole scraped page.

import { getYouTubeMeta, isYouTubeUrl } from './_lib/youtube.js'

export const config = { maxDuration: 30 }

export default async function handler(req, res) {
  const url = req.query?.url
  if (!url) {
    res.status(400).json({ error: 'Missing url param' })
    return
  }
  if (!isYouTubeUrl(url)) {
    res.status(400).json({ error: 'Not a YouTube link' })
    return
  }
  try {
    res.status(200).json(await getYouTubeMeta(url))
  } catch (err) {
    res.status(502).json({ error: err?.message || 'Could not read that video' })
  }
}
