// Firebase Storage uploads for recipe photos and avatars, with a safe fallback.
//
// If Storage isn't enabled in the Firebase console (or rules block the write),
// uploadImage degrades gracefully to a compact inline data URL so saving a
// recipe/avatar never breaks. Once the bucket + rules are set up, images go to
// Storage and only a short download URL is stored on the document.

import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { app } from '../firebase.js'
import {
  decodeImage,
  releaseImage,
  scaledBlobFrom,
  scaledDataUrlFrom,
  withTimeout,
} from './image.js'

// Firebase retries a stalled upload for ~2 minutes before giving up. That is far
// too long to leave someone staring at "Uploading…" on a phone, and the inline
// fallback below works offline anyway — so cut over much sooner.
const UPLOAD_TIMEOUT_MS = 30000

let _storage = null
function storage() {
  return _storage || (_storage = getStorage(app))
}

// pathPrefix e.g. `recipes/<uid>` or `avatars/<uid>`. Returns a URL string.
export async function uploadImage(file, pathPrefix) {
  // Decode once and reuse it for both the upload and the fallback. Re-reading
  // the original file after a failure doubles peak memory on exactly the
  // low-end devices where the first attempt is most likely to have struggled.
  // A decode failure is fatal — without pixels there is no fallback to make —
  // so it propagates to the caller, which shows an error instead of spinning.
  const img = await decodeImage(file)
  try {
    const blob = await scaledBlobFrom(img)
    try {
      const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
      const r = ref(storage(), `${pathPrefix}/${name}`)
      await withTimeout(
        uploadBytes(r, blob, { contentType: 'image/jpeg', cacheControl: 'public,max-age=31536000' }),
        UPLOAD_TIMEOUT_MS,
        'Upload timed out',
      )
      return await withTimeout(getDownloadURL(r), UPLOAD_TIMEOUT_MS, 'Upload timed out')
    } catch {
      // Storage unavailable, blocked, or too slow — keep the photo inline.
      return scaledDataUrlFrom(img)
    }
  } finally {
    releaseImage(img)
  }
}
