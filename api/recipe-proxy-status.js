// Vercel serverless function: GET /api/recipe-proxy-status?jobId=...
// Polled repeatedly by the client until the bridge's page fetch is done.
export const config = { maxDuration: 20 }

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  const bridgeUrl = process.env.VIDEO_BRIDGE_URL
  const bridgeSecret = process.env.VIDEO_BRIDGE_SECRET
  if (!bridgeUrl || !bridgeSecret) {
    res.status(500).json({ error: 'Page fetching is not configured on the server.' })
    return
  }

  const jobId = (req.query?.jobId || '').toString().trim()
  if (!jobId) {
    res.status(400).json({ error: 'Missing jobId' })
    return
  }

  try {
    const callBridge = async (timeoutMs) => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        return await fetch(`${bridgeUrl}/status?jobId=${encodeURIComponent(jobId)}`, {
          headers: { 'x-video-secret': bridgeSecret },
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
      // Same reasoning as recipe-proxy-start.js: the client polls this every
      // 2s for up to 60s, so one short retry here absorbs a transient
      // connection blip instead of reporting a terminal error on the first
      // bad poll and killing an import that would have succeeded seconds later.
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
      throw new Error(data.error || `Status check failed (${bridgeRes.status}).`)
    }

    if (data.state === 'running') {
      res.status(200).json({ state: 'running', stage: data.stage, progress: data.progress, etaMs: data.etaMs })
      return
    }
    if (data.state === 'error') {
      res.status(200).json({ state: 'error', error: data.error || 'Could not fetch that page.' })
      return
    }
    res.status(200).json({ state: 'done', html: data.html })
  } catch (err) {
    res.status(200).json({ state: 'error', error: err?.message || 'Page fetch failed' })
  }
}
