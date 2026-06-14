// Firebase Storage uploads for recipe photos and avatars, with a safe fallback.
//
// If Storage isn't enabled in the Firebase console (or rules block the write),
// uploadImage degrades gracefully to a compact inline data URL so saving a
// recipe/avatar never breaks. Once the bucket + rules are set up, images go to
// Storage and only a short download URL is stored on the document.

import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { app } from '../firebase.js'
import { fileToScaledBlob, fileToScaledDataUrl } from './image.js'

let _storage = null
function storage() {
  return _storage || (_storage = getStorage(app))
}

// pathPrefix e.g. `recipes/<uid>` or `avatars/<uid>`. Returns a URL string.
export async function uploadImage(file, pathPrefix) {
  try {
    const blob = await fileToScaledBlob(file)
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
    const r = ref(storage(), `${pathPrefix}/${name}`)
    await uploadBytes(r, blob, { contentType: 'image/jpeg', cacheControl: 'public,max-age=31536000' })
    return await getDownloadURL(r)
  } catch {
    // Storage unavailable/blocked — fall back to an inline (size-capped) data URL.
    return fileToScaledDataUrl(file)
  }
}
