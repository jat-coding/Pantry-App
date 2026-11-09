// Keep our own copy of a recipe's remote image so the recipe survives the source URL
// dying. The original bytes are stored untouched (no re-compression = equal quality);
// only images over Storage's 5 MB write limit would need re-encoding, and the fetch
// endpoint already refuses anything over ~4 MB, so those keep their original link.
// Never throws: on any failure the original URL is returned and the recipe is unchanged.
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { app } from '../firebase.js'
import { decodeImage, releaseImage, scaledBlobFrom, scaledDataUrlFrom, withTimeout } from './image.js'

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' }

export function isExternalImage(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url) && !url.includes('firebasestorage.googleapis.com')
}

export async function snapshotImage(url, uid) {
  if (!isExternalImage(url) || !uid) return url
  try {
    const resp = await withTimeout(
      fetch(`/api/image-fetch?url=${encodeURIComponent(url)}`),
      20000, 'fetch timed out',
    )
    if (!resp.ok) return url
    const blob = await resp.blob()
    if (!blob.type.startsWith('image/') || blob.size >= 5 * 1024 * 1024) return url
    // "Works" = the browser can actually decode it, same as it would to display it.
    const img = await decodeImage(new File([blob], 'snap', { type: blob.type }))
    releaseImage(img)
    const name = `snap-${Date.now()}-${Math.random().toString(36).slice(2)}.${EXT[blob.type] || 'img'}`
    const r = ref(getStorage(app), `recipes/${uid}/${name}`)
    await withTimeout(
      uploadBytes(r, blob, { contentType: blob.type, cacheControl: 'public,max-age=31536000' }),
      30000, 'upload timed out',
    )
    return await getDownloadURL(r)
  } catch {
    return url
  }
}

// ---------- Social feed: forked and compressed copies ----------

// Bytes of any image URL: data URLs locally, anything else (Firebase Storage
// included) through the same server-side fetch endpoint, so bucket CORS never matters.
async function fetchImageBlob(url) {
  const resp = await withTimeout(
    fetch(url.startsWith('data:') ? url : `/api/image-fetch?url=${encodeURIComponent(url)}`),
    20000, 'fetch timed out',
  )
  if (!resp.ok) throw new Error('fetch failed')
  const blob = await resp.blob()
  if (!blob.type.startsWith('image/')) throw new Error('not an image')
  return blob
}

async function uploadTo(uid, prefix, blob) {
  const name = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}.${EXT[blob.type] || 'img'}`
  const r = ref(getStorage(app), `recipes/${uid}/${name}`)
  await withTimeout(
    uploadBytes(r, blob, { contentType: blob.type, cacheControl: 'public,max-age=31536000' }),
    30000, 'upload timed out',
  )
  return getDownloadURL(r)
}

// Copying a feed post: our own copy of the photo in recipes/{uid}/, untouched, so the
// copy keeps its picture after the author's post expires and their full-res file is
// deleted. Unlike snapshotImage this also forks Firebase Storage URLs -- that is the
// whole point here. A data URL is already self-contained. Never throws.
export async function forkImage(url, uid) {
  if (!url || !uid || url.startsWith('data:')) return url
  try {
    const blob = await fetchImageBlob(url)
    if (blob.size >= 5 * 1024 * 1024) return url
    return await uploadTo(uid, 'fork', blob)
  } catch {
    return url
  }
}

// The permanent, smaller record of a posted recipe's photo (what the recipe falls back
// to once its feed post expires). Same decode/downscale/encode helpers as every other
// image path. Returns '' when it can't be made, so the caller knows not to delete the
// full-res original later.
export const COMPRESSED_MAX_EDGE = 800
export const COMPRESSED_QUALITY = 0.7
export async function compressedCopy(url, uid) {
  if (!url || !uid) return ''
  try {
    const blob = await fetchImageBlob(url)
    const img = await decodeImage(new File([blob], 'src', { type: blob.type }))
    try {
      if (url.startsWith('data:')) return await scaledDataUrlFrom(img, { maxEdge: COMPRESSED_MAX_EDGE, maxBytes: 150 * 1024 })
      const small = await scaledBlobFrom(img, { maxEdge: COMPRESSED_MAX_EDGE, quality: COMPRESSED_QUALITY })
      return await uploadTo(uid, 'compressed', small)
    } finally {
      releaseImage(img)
    }
  } catch {
    return ''
  }
}

// Delete one of MY OWN Storage files by its download URL (storage.rules only lets an
// owner delete in recipes/{uid}/). Anything else -- a data URL, someone else's file,
// an external link -- is left alone. Never throws.
export async function deleteOwnImage(url, uid) {
  if (!url || !uid || !url.includes('firebasestorage.googleapis.com')) return false
  try {
    const r = ref(getStorage(app), url)
    if (!r.fullPath.startsWith(`recipes/${uid}/`)) return false
    await deleteObject(r)
    return true
  } catch {
    return false
  }
}
