// Keep our own copy of a recipe's remote image so the recipe survives the source URL
// dying. The original bytes are stored untouched (no re-compression = equal quality);
// only images over Storage's 5 MB write limit would need re-encoding, and the fetch
// endpoint already refuses anything over ~4 MB, so those keep their original link.
// Never throws: on any failure the original URL is returned and the recipe is unchanged.
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { app } from '../firebase.js'
import { decodeImage, releaseImage, withTimeout } from './image.js'

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

// ---------- Social feed ----------

// Delete one of MY OWN Storage files by its download URL (an expired post's photo) (storage.rules only lets an
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
