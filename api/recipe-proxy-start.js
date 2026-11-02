// Vercel serverless function: POST /api/recipe-proxy-start
// Body: { url }
// Fetches an arbitrary recipe-site page from the same personal-Mac bridge as
// video import, instead of directly from this Vercel function -- job-shaped
// so a slow site can never get cut off by Vercel's own timeout ceiling.
export const config = { maxDuration: 20 }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  const bridgeUrl = process.env.VIDEO_BRIDGE_URL
  const bridgeSecret = process.env.VIDEO_BRIDGE_SECRET
  if (!bridgeUrl || !bridgeSecret) {
    res.status(500).json({ error: 'Page fetching is not configured on the server.' })
    return
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const url = (body.url || '').trim()
    if (!url) {
      res.status(400).json({ error: 'Missing url' })
      return
    }

    const callBridge = async (timeoutMs) => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        return await fetch(`${bridgeUrl}/start`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-video-secret': bridgeSecret },
          body: JSON.stringify({ url, mode: 'page' }),
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timer)
      }
    }

    let bridgeRes
    try {
      bridgeRes = await callBridge(14_000)
    } catch (err) {
      // A real timeout already spent the full budget -- retrying would just
      // time out again. A connection-level failure (DNS blip, bridge mid-
      // restart) fails almost instantly, so one short retry absorbs it
      // without a user-visible or monitor-visible outage.
      if (err?.name === 'AbortError') {
        throw new Error('Could not reach the fetch service (timed out).')
      }
      try {
        bridgeRes = await callBridge(4_000)
      } catch (err2) {
        const reason = err2?.name === 'AbortError' ? 'timed out' : (err2?.message || 'unreachable')
        throw new Error(`Could not reach the fetch service (${reason}).`)
      }
    }

    const data = await bridgeRes.json().catch(() => ({}))
    if (!bridgeRes.ok || !data.ok) {
      throw new Error(data.error || `Could not start fetching that page (${bridgeRes.status}).`)
    }
    res.status(200).json({ jobId: data.jobId })
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Page fetch failed' })
  }
}
