// Client helpers for the recipe-import pipeline.
//
// These call our own serverless function at /api/parse, which holds the
// Anthropic API key server-side. No key is ever exposed to the browser.

async function callParse(payload) {
  const res = await fetch('/api/parse', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
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
