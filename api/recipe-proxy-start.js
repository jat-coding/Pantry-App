// Vercel serverless function: POST /api/recipe-proxy-start
// Body: { url }
// Normal path: ask the home bridge (VIDEO_BRIDGE_URL, over Tailscale Funnel) to fetch
// the page as a job -> { jobId, via: 'bridge' }; the client then polls
// recipe-proxy-status. The bridge can do things this function can't (a real headless
// browser for bot-protected sites).
//
// Fallback (2026-11-21): the bridge link drops every week or two (Wi-Fi roam, Windows
// reboot, bridge restart), and every import used to fail with it. If the bridge can't
// be reached after one short retry, fetch the page directly from here and return it
// inline -> { html, via: 'direct', bridgeError }. No job, no polling.
import { fetchPageDirect, BLOCKED_ERROR } from './_lib/directFetch.js'

export const config = { maxDuration: 30 }

const BRIDGE_FIRST_MS = 7_000
const BRIDGE_RETRY_MS = 4_000
const BRIDGE_BACKOFF_MS = 500
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Try the bridge, once more after a short backoff. Returns { jobId } or { error }.
// Only "the bridge is unreachable/broken" counts as an error worth falling back on;
// the bridge saying no to the URL itself is passed through as { refused }.
export async function startOnBridge(url, { bridgeUrl, bridgeSecret, fetchImpl = fetch } = {}) {
  if (!bridgeUrl || !bridgeSecret) return { error: 'bridge not configured' }
  const call = async (timeoutMs) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const r = await fetchImpl(`${bridgeUrl}/start`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-video-secret': bridgeSecret },
        body: JSON.stringify({ url, mode: 'page' }),
        signal: controller.signal,
      })
      const data = await r.json().catch(() => ({}))
      if (r.ok && data.ok && data.jobId) return { jobId: data.jobId }
      // A 400 with a real answer from the bridge (bad url, refused host) is final.
      // Anything else (401 bad secret, 502 from Funnel, 5xx) means the bridge path is broken.
      if (r.status === 400 && data.error) return { refused: data.error }
      return { error: data.error || `bridge HTTP ${r.status}` }
    } catch (err) {
      return { error: err?.name === 'AbortError' ? 'timed out' : (err?.message || 'unreachable') }
    } finally {
      clearTimeout(timer)
    }
  }
  const first = await call(BRIDGE_FIRST_MS)
  if (first.jobId || first.refused) return first
  await sleep(BRIDGE_BACKOFF_MS)
  const second = await call(BRIDGE_RETRY_MS)
  if (second.jobId || second.refused) return second
  return { error: `${first.error}; retry: ${second.error}` }
}

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

  const bridge = await startOnBridge(url, {
    bridgeUrl: process.env.VIDEO_BRIDGE_URL,
    bridgeSecret: process.env.VIDEO_BRIDGE_SECRET,
  })
  if (bridge.jobId) {
    res.status(200).json({ jobId: bridge.jobId, via: 'bridge' })
    return
  }
  if (bridge.refused) {
    res.status(400).json({ error: bridge.refused })
    return
  }

  console.warn(`recipe-proxy-start: bridge unavailable (${bridge.error}), fetching directly`)
  const direct = await fetchPageDirect(url, { deadlineMs: 15_000 })
  if (direct.ok) {
    res.status(200).json({ html: direct.html, via: 'direct', bridgeError: bridge.error })
    return
  }
  // Same 200 + error shape the client already understands from status polling, so the
  // site's own answer (HTTP 403, page too large...) gets the friendly message.
  res.status(direct.error === BLOCKED_ERROR ? 400 : 502).json({
    error: direct.error, via: 'direct', bridgeError: bridge.error,
  })
}
