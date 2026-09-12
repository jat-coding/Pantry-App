// Vercel serverless function: GET /api/video-meta?url=<encoded>
// Returns a YouTube video's title + description as structured JSON, so the
// importer can hand Claude just the recipe text instead of a whole scraped page.
//
// Routed through the same personal-Mac bridge as video-import: fetching the
// watch page's HTML directly from a Vercel function's datacenter IP reliably
// triggers YouTube's "confirm you're not a bot" wall (confirmed 2026-09-12 --
// the identical request from a residential IP via yt-dlp's internal-API
// extraction came back clean, no challenge at all).

import { isYouTubeUrl } from './_lib/youtube.js'

// yt-dlp's response time for this varies a lot by observation (2-80s for the
// same video on separate calls) -- generous on purpose, this is otherwise a
// simple passthrough with nothing else to make slow.
export const config = { maxDuration: 60 }

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

  const bridgeUrl = process.env.VIDEO_BRIDGE_URL
  const bridgeSecret = process.env.VIDEO_BRIDGE_SECRET
  if (!bridgeUrl || !bridgeSecret) {
    res.status(500).json({ error: 'Video reading is not configured on the server.' })
    return
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 55_000)
  try {
    const bridgeRes = await fetch(`${bridgeUrl}/meta?url=${encodeURIComponent(url)}`, {
      headers: { 'x-video-secret': bridgeSecret },
      signal: controller.signal,
    })
    const data = await bridgeRes.json().catch(() => ({}))
    if (!bridgeRes.ok || !data.ok) {
      throw new Error(data.error || `Could not read that video (${bridgeRes.status}).`)
    }
    res.status(200).json({ title: data.title, description: data.description, hasCaptions: data.hasCaptions })
  } catch (err) {
    const reason = err?.name === 'AbortError' ? 'timed out' : (err?.message || 'unreachable')
    res.status(502).json({ error: `Could not read that video (${reason}).` })
  } finally {
    clearTimeout(timer)
  }
}
