// Vercel serverless function: POST /api/video-import-start
// Body: { url }
// Kicks off the bridge's video download+transcribe pipeline and returns a jobId
// immediately — the pipeline itself can run past a minute, well over what a
// single Vercel invocation should block on regardless of plan tier. The client
// polls /api/video-import-status with the jobId until it's done.
export const config = { maxDuration: 20 }

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
    const timer = setTimeout(() => controller.abort(), 15_000)
    let bridgeRes
    try {
      bridgeRes = await fetch(`${bridgeUrl}/start`, {
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
      throw new Error(data.error || `Could not start transcription (${bridgeRes.status}).`)
    }
    res.status(200).json({ jobId: data.jobId })
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Video import failed' })
  }
}
