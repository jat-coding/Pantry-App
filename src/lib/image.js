// Shared image helpers: decode a chosen photo, downscale it, and compress it to
// a budget. Used by the recipe photo field, the import flow, and the profile
// avatar so every image path behaves the same and can't blow past Firestore's
// 1 MB document limit when stored inline.
//
// Every step is bounded by a timeout. A decode that stalls (common on Android
// with large camera photos) must still settle its promise — otherwise the
// caller's `finally` never runs and the UI sits on "Uploading…" forever.

const DECODE_TIMEOUT_MS = 20000
const ENCODE_TIMEOUT_MS = 15000

// Reject if `promise` hasn't settled in `ms`, so no caller can hang forever.
export function withTimeout(promise, ms, message) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

// Decoding via createImageBitmap avoids the base64 round-trip that
// FileReader.readAsDataURL forces — a 12 MP phone photo becomes an ~8 MB string
// before it is even decoded, which is what pushes low-memory Android devices
// over the edge. It also applies EXIF rotation, so portrait shots aren't
// sideways.
async function decodeViaBitmap(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    // Some older Android builds reject the options argument outright.
    return await createImageBitmap(file)
  }
}

// Fallback decode: an object URL still avoids base64, unlike readAsDataURL.
function decodeViaObjectUrl(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    const settle = (fn, arg) => { URL.revokeObjectURL(url); fn(arg) }
    // The bitmap is already decoded by onload, so revoking here is safe.
    img.onload = () => settle(resolve, img)
    img.onerror = () => settle(reject, new Error('Could not read that image.'))
    img.src = url
  })
}

// Decode a File into something drawable (ImageBitmap or HTMLImageElement —
// both expose width/height and both work with drawImage).
export function decodeImage(file) {
  const attempt = (async () => {
    if (typeof createImageBitmap === 'function') {
      try {
        return await decodeViaBitmap(file)
      } catch {
        // Fall through to the object-URL path.
      }
    }
    return decodeViaObjectUrl(file)
  })()
  return withTimeout(
    attempt,
    DECODE_TIMEOUT_MS,
    'That photo took too long to open. Try a smaller one.',
  )
}

// ImageBitmaps hold native memory until closed — important on mobile.
export function releaseImage(img) {
  img?.close?.()
}

function drawScaled(img, maxEdge, quality) {
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not process that image.')
  ctx.drawImage(img, 0, 0, w, h)
  return canvas
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode image'))),
      'image/jpeg',
      quality,
    )
  })
}

// Approximate decoded byte size of a data URL from its base64 payload length.
function approxBytes(dataUrl) {
  const i = dataUrl.indexOf(',')
  return Math.floor(((dataUrl.length - i - 1) * 3) / 4)
}

// Downscale + compress an already-decoded image to a JPEG data URL kept under
// `maxBytes`. Drops quality first, then dimensions.
export function scaledDataUrlFrom(img, { maxEdge = 1000, maxBytes = 800 * 1024 } = {}) {
  let edge = maxEdge
  let quality = 0.85
  let dataUrl = drawScaled(img, edge, quality).toDataURL('image/jpeg', quality)
  let guard = 0
  while (approxBytes(dataUrl) > maxBytes && guard < 12) {
    if (quality > 0.45) quality -= 0.1
    else { edge = Math.round(edge * 0.85); quality = 0.7 }
    dataUrl = drawScaled(img, edge, quality).toDataURL('image/jpeg', quality)
    guard++
  }
  return dataUrl
}

// Same scaling, but returns a Blob for uploading to Firebase Storage.
export function scaledBlobFrom(img, { maxEdge = 1400, quality = 0.85 } = {}) {
  return withTimeout(
    canvasToBlob(drawScaled(img, maxEdge, quality), quality),
    ENCODE_TIMEOUT_MS,
    'That photo took too long to process. Try a smaller one.',
  )
}

// File-in convenience wrappers. Prefer decoding once and reusing the result
// when you need both forms (see uploadImage).
export async function fileToScaledDataUrl(file, opts) {
  const img = await decodeImage(file)
  try {
    return scaledDataUrlFrom(img, opts)
  } finally {
    releaseImage(img)
  }
}

export async function fileToScaledBlob(file, opts) {
  const img = await decodeImage(file)
  try {
    return await scaledBlobFrom(img, opts)
  } finally {
    releaseImage(img)
  }
}
