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

// Read a video directly (download + transcribe + sample frames) when its own
// description doesn't contain the recipe. Slower than every other import path
// by a wide margin — a separate, much longer timeout, not callParse's 65s.
export async function normalizeRecipeVideo(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 115000)
  let res
  try {
    res = await fetch('/api/video-import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: controller.signal,
    })
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error('Reading that video took too long — please try again.')
    throw new Error('Network error — check your connection and try again.')
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) {
    let msg = `Video import failed (${res.status})`
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
