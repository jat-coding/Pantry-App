// Vercel serverless function: GET /api/video-meta-status?jobId=...
// Polled repeatedly by the client. Forwards the bridge's job state -- no
// Claude call happens here, this is metadata only.
export const config = { maxDuration: 20 }

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  const bridgeUrl = process.env.VIDEO_BRIDGE_URL
  const bridgeSecret = process.env.VIDEO_BRIDGE_SECRET
  if (!bridgeUrl || !bridgeSecret) {
    res.status(500).json({ error: 'Video reading is not configured on the server.' })
    return
  }

  const jobId = (req.query?.jobId || '').toString().trim()
  if (!jobId) {
    res.status(400).json({ error: 'Missing jobId' })
    return
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)
    let bridgeRes
    try {
      bridgeRes = await fetch(`${bridgeUrl}/status?jobId=${encodeURIComponent(jobId)}`, {
        headers: { 'x-video-secret': bridgeSecret },
        signal: controller.signal,
      })
    } catch (err) {
      const reason = err?.name === 'AbortError' ? 'timed out' : (err?.message || 'unreachable')
      throw new Error(`Could not reach the video-reading service (${reason}).`)
    } finally {
      clearTimeout(timer)
    }

    const data = await bridgeRes.json().catch(() => ({}))
    if (!bridgeRes.ok || !data.ok) {
      throw new Error(data.error || `Status check failed (${bridgeRes.status}).`)
    }

    if (data.state === 'running') {
      res.status(200).json({ state: 'running', stage: data.stage })
      return
    }
    if (data.state === 'error') {
      res.status(200).json({ state: 'error', error: data.error || 'Could not read that video.' })
      return
    }
    res.status(200).json({ state: 'done', title: data.title, description: data.description, hasCaptions: data.hasCaptions })
  } catch (err) {
    res.status(200).json({ state: 'error', error: err?.message || 'Video read failed' })
  }
}
