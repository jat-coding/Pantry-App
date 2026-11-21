// Client helpers for the recipe-import pipeline.
//
// These call our own serverless function at /api/parse, which holds the
// Anthropic API key server-side. No key is ever exposed to the browser.

async function callParse(payload) {
  // Hard timeout so a stuck request can never leave the UI spinning forever.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 65000)
  let res
  try {
    res = await fetch('/api/parse', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error('That took too long — please try again.')
    throw new Error('Network error — check your connection and try again.')
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) {
    let msg = `Parse failed (${res.status})`
    try {
      const data = await res.json()
      if (data?.error) msg = data.error
    } catch {
      // non-JSON error body — keep the status message
    }
    throw new Error(msg)
  }
  return res.json()
}

// AI parsing now lives on the server. The browser can't see whether the key is
// configured, so we assume it's available and let the server return a clear
// error if it isn't. Kept as a function so existing call sites don't change.
export function hasApiKey() {
  return true
}

// Normalize freeform recipe text (Paste tab + URL-import fallback).
export function normalizeRecipeText(rawText) {
  return callParse({ mode: 'text', text: rawText })
}

// Extract a recipe from a photo (base64, no data: prefix) — vision.
export function normalizeRecipeImage(base64, mediaType = 'image/jpeg') {
  return callParse({ mode: 'image', base64, mediaType })
}

// Extract a recipe from a PDF (base64, no data: prefix). Claude reads the file
// itself, so both digital and scanned/photographed pages work.
export function normalizeRecipePdf(base64) {
  return callParse({ mode: 'pdf', base64 })
}

async function postJson(url, body, ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error('That took too long — please try again.')
    throw new Error('Network error — check your connection and try again.')
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    try {
      const data = await res.json()
      if (data?.error) msg = data.error
    } catch {
      // non-JSON error body — keep the status message
    }
    throw new Error(msg)
  }
  return res.json()
}

async function getJson(url, ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    const res = await fetch(url, { signal: controller.signal })
    return await res.json()
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error('That took too long — please try again.')
    throw new Error('Network error — check your connection and try again.')
  } finally {
    clearTimeout(timer)
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Shared shape for every bridge job (video metadata, full transcribe, page fetch):
// start, then check in every couple of seconds — no single network call stays open
// long, no matter how long the job itself takes. Each check-in carries the bridge's own
// real progress (yt-dlp/whisper percentages where they exist) and an ETA learned from
// past completed jobs, so `onProgress({ progress, etaMs, stage })` reflects what the
// job is actually doing rather than a fixed guess.
async function pollJob(startUrl, statusUrl, url, { onProgress, deadlineMs = 4 * 60 * 1000, subject = 'that video', statusTimeoutMs = 20000 } = {}) {
  const started = Date.now()
  const { jobId } = await postJson(startUrl, { url }, 20000)

  const deadline = started + deadlineMs
  while (Date.now() < deadline) {
    await sleep(2000)
    const data = await getJson(`${statusUrl}?jobId=${encodeURIComponent(jobId)}`, statusTimeoutMs)
    if (data.state === 'done') return data
    if (data.state === 'error') throw new Error(data.error || `Could not read ${subject}`)
    onProgress?.({ progress: data.progress ?? 0, etaMs: data.etaMs, stage: data.stage })
  }
  throw new Error(`Reading ${subject} is taking unusually long — please try again later.`)
}

// Video import has no fallback: downloading + transcribing needs the home video
// service (yt-dlp, whisper). When that service can't be reached, say so plainly and
// point at what still works, instead of a raw "could not reach ... (fetch failed)".
export const VIDEO_SERVICE_DOWN_MESSAGE =
  'Video import is offline right now (our video service can\'t be reached). Recipe website links still work. Try the video again in a little while, or paste the recipe text into the Paste tab.'

export function isServiceUnreachable(message) {
  return /could not reach the (transcription|video-reading|fetch) service|not configured on the server|status check failed \(5\d\d\)|could not start (transcription|reading that video) \(5\d\d\)|network error|that took too long/i
    .test(message || '')
}

async function withVideoServiceMessage(fn) {
  try {
    return await fn()
  } catch (err) {
    if (isServiceUnreachable(err?.message)) throw new Error(VIDEO_SERVICE_DOWN_MESSAGE)
    throw err
  }
}

// Read a video directly (download + transcribe + sample frames) when its own
// description doesn't contain the recipe. Slower than every other import path
// by a wide margin.
export async function normalizeRecipeVideo(url, { onProgress } = {}) {
  // The final check-in is also where the recipe gets built from transcript + frames,
  // which takes longer than a plain status lookup — give that one call more room.
  const data = await withVideoServiceMessage(() =>
    pollJob('/api/video-import-start', '/api/video-import-status', url, { onProgress, statusTimeoutMs: 60000 }))
  return data.recipe
}

// Title + description + caption availability for any supported video link
// (YouTube, TikTok, Instagram, Facebook) — no download, but still job-shaped
// since even this has shown up to ~80s of YouTube-side response variance.
export async function fetchVideoMeta(url, { onProgress } = {}) {
  const data = await withVideoServiceMessage(() =>
    pollJob('/api/video-meta-start', '/api/video-meta-status', url, { onProgress, deadlineMs: 2 * 60 * 1000 }))
  return { title: data.title, description: data.description, hasCaptions: data.hasCaptions, thumbnail: data.thumbnail || null }
}

// The site's own verdict on the URL. Retrying through another path won't change it.
export function isSiteVerdict(raw) {
  return /^HTTP \d{3}$/.test(raw || '') || raw === 'page too large' || raw === 'timed out'
    || (raw || '').includes('can’t fetch from') || raw === 'too many redirects'
}

// Fetch a recipe page's HTML. Normal path: the home bridge (it has a real browser for
// bot-protected sites). If the bridge can't be reached, the server fetches the page
// itself and hands the HTML straight back from the start call. If the bridge drops
// mid-job (status polling breaks), ask the server for a direct fetch here.
export async function fetchPageViaBridge(url, { onProgress, fetchImpl } = {}) {
  const post = fetchImpl ? (u, b) => fetchImpl.post(u, b) : (u, b) => postJson(u, b, 35000)
  const get = fetchImpl ? (u) => fetchImpl.get(u) : (u) => getJson(u, 20000)
  const pause = fetchImpl?.sleep || sleep
  const direct = async () => {
    const d = await post('/api/recipe-fetch-direct', { url })
    return d.html
  }
  try {
    let start
    try {
      start = await post('/api/recipe-proxy-start', { url })
    } catch (err) {
      if (isSiteVerdict(err.message)) throw err
      return await direct()
    }
    if (start.html) return start.html
    if (!start.jobId) return await direct()

    const deadline = Date.now() + 60 * 1000
    while (Date.now() < deadline) {
      await pause(2000)
      let data
      try {
        data = await get(`/api/recipe-proxy-status?jobId=${encodeURIComponent(start.jobId)}`)
      } catch {
        return await direct()
      }
      if (data.state === 'done') return data.html
      if (data.state === 'error') {
        if (isSiteVerdict(data.error)) throw new Error(data.error)
        return await direct()
      }
      onProgress?.({ progress: data.progress ?? 0, etaMs: data.etaMs, stage: data.stage })
    }
    throw new Error('Reading that page is taking unusually long — please try again later.')
  } catch (err) {
    throw new Error(explainPageFetchError(err.message))
  }
}

// The bridge's raw fetch failure ("HTTP 403", "page too large", ...) tells a
// developer what happened but not a user what to do about it. Translate the
// known shapes into a message that says both.
function explainPageFetchError(raw) {
  const status = /^HTTP (\d{3})$/.exec(raw || '')
  if (status) {
    const code = Number(status[1])
    if (code === 403 || code === 429) {
      return `This site blocked the automatic import — some sites don't allow recipe apps to read their pages. Try: find a printable or PDF version of the recipe and use the File tab, or copy the recipe text into the Paste tab instead.`
    }
    if (code === 404) {
      return `That page doesn't exist (HTTP 404) — double check the link.`
    }
    if (code >= 500) {
      return `The site is having trouble right now (HTTP ${code}) — try again in a few minutes.`
    }
    return `The site returned an error (HTTP ${code}) — try again, or use the Paste tab with the recipe text instead.`
  }
  if (raw === 'page too large') {
    return `That page is too large to import automatically — use the Paste tab with the recipe text instead.`
  }
  if (raw === 'timed out') {
    return `The site took too long to respond — try again in a moment.`
  }
  if (raw && raw.includes('can’t fetch from')) {
    return `That link can't be imported automatically — double check it's a public recipe page.`
  }
  return raw || `Couldn't read that page — try again, or use the Paste tab with the recipe text instead.`
}
