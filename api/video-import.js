// Vercel serverless function: POST /api/video-import
// Body: { url }
// Returns the structured recipe JSON, built from a video's own audio + frames
// instead of its description text. Slower and heavier than /api/video-meta —
// only worth calling when the description path already came back empty.
//
// The actual download + transcription runs on a personal machine (whisper.cpp
// + yt-dlp, no per-video vendor cost), reached over Tailscale Funnel. This
// function is the thin bridge between that and the existing Claude parser.

import { parseRecipe } from './_lib/recipe.js'

// Download + ffmpeg + whisper on a multi-minute video can run past a minute on
// its own, before Claude even sees the result. 120s is Vercel's ceiling on a
// Hobby-tier project; a Pro-tier project can raise this if longer videos need it.
export const config = { maxDuration: 120 }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  const bridgeUrl = process.env.VIDEO_BRIDGE_URL
  const bridgeSecret = process.env.VIDEO_BRIDGE_SECRET
  if (!bridgeUrl || !bridgeSecret) {
    res.status(500).json({ error: 'Video transcription is not configured on the server.' })
    return
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const url = (body.url || '').trim()
    if (!url) {
      res.status(400).json({ error: 'Missing url' })
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 110_000)
    let bridgeRes
    try {
      bridgeRes = await fetch(bridgeUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-video-secret': bridgeSecret },
        body: JSON.stringify({ url }),
        signal: controller.signal,
      })
    } catch (err) {
      const reason = err?.name === 'AbortError' ? 'timed out' : (err?.message || 'unreachable')
      throw new Error(`Could not reach the transcription service (${reason}).`)
    } finally {
      clearTimeout(timer)
    }

    const data = await bridgeRes.json().catch(() => ({}))
    if (!bridgeRes.ok || !data.ok) {
      throw new Error(data.error || `Transcription failed (${bridgeRes.status}).`)
    }

    const recipe = await parseRecipe({ mode: 'video', text: data.transcript, images: data.frames })
    res.status(200).json(recipe)
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Video import failed' })
  }
}
