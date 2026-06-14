// Shared image helpers: load a chosen photo, downscale it, and compress it to a
// budget. Used by the recipe photo field, the import flow, and the profile
// avatar so every image path behaves the same and can't blow past Firestore's
// 1 MB document limit when stored inline.

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => resolve(img)
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

function drawScaled(img, maxEdge, quality) {
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d').drawImage(img, 0, 0, w, h)
  return canvas
}

// Approximate decoded byte size of a data URL from its base64 payload length.
function approxBytes(dataUrl) {
  const i = dataUrl.indexOf(',')
  return Math.floor(((dataUrl.length - i - 1) * 3) / 4)
}

// Downscale + compress to a JPEG data URL kept under `maxBytes`. Drops quality
// first, then dimensions, so we never store an oversized image inline.
export async function fileToScaledDataUrl(file, { maxEdge = 1000, maxBytes = 800 * 1024 } = {}) {
  const img = await loadImage(file)
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
export async function fileToScaledBlob(file, { maxEdge = 1400, quality = 0.85 } = {}) {
  const img = await loadImage(file)
  const canvas = drawScaled(img, maxEdge, quality)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode image'))),
      'image/jpeg',
      quality,
    )
  })
}
