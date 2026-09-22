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

// Video has no inline fallback (see uploadVideo below), so it gets a longer
// timeout than the image path — a real recipe clip at a few dozen MB just
// takes longer than 30s on a phone connection, and there's nowhere to fall
// back to if we cut it off early.
const VIDEO_UPLOAD_TIMEOUT_MS = 120000

// Matches storage.rules' cap for recipes/{uid} video writes. Checked client-side
// too so a doomed upload fails immediately with a clear reason instead of
// spending two minutes to learn the rules rejected it.
const MAX_VIDEO_BYTES = 50 * 1024 * 1024

// Errors that will repeat identically for every later upload this session:
// there is no bucket, or we are not allowed to write to it.
const PERMANENT_CODES = new Set([
  'storage/bucket-not-found',
  'storage/project-not-found',
  'storage/unauthorized',
  'storage/unauthenticated',
])

function isPermanent(err) {
  if (PERMANENT_CODES.has(err?.code)) return true
  // A bucket that was never created surfaces as a generic error carrying the
  // underlying 404 rather than a specific code.
  const body = String(err?.customData?.serverResponse || err?.message || '')
  return /\b404\b|bucket .*(not found|does not exist)|does not exist/i.test(body)
}

// Once Storage has told us it can't serve us, every subsequent photo would wait
// out the same timeout for the same answer. Remember it and go straight to the
// inline fallback — this is the difference between one slow photo and every
// photo being slow.
let storageUnavailable = false

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
    if (!storageUnavailable) {
      try {
        const blob = await scaledBlobFrom(img)
        const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
        const r = ref(storage(), `${pathPrefix}/${name}`)
        await withTimeout(
          uploadBytes(r, blob, { contentType: 'image/jpeg', cacheControl: 'public,max-age=31536000' }),
          UPLOAD_TIMEOUT_MS,
          'Upload timed out',
        )
        return await withTimeout(getDownloadURL(r), UPLOAD_TIMEOUT_MS, 'Upload timed out')
      } catch (err) {
        // Storage unavailable, blocked, or too slow — keep the photo inline.
        if (isPermanent(err)) storageUnavailable = true
      }
    }
    return await scaledDataUrlFrom(img)
  } finally {
    releaseImage(img)
  }
}

// pathPrefix e.g. `recipes/<uid>`. Returns a download URL string.
//
// Unlike uploadImage there is no inline data-URL fallback: even a downscaled
// photo fits comfortably in Firestore's 1 MB document limit, but a video
// never would, so Storage has to actually work. A failure here is thrown to
// the caller as a real error instead of silently degrading.
export async function uploadVideo(file, pathPrefix) {
  if (!file.type?.startsWith('video/')) throw new Error('That file is not a video')
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error(`Video is too large (max ${Math.floor(MAX_VIDEO_BYTES / 1024 / 1024)}MB)`)
  }
  const ext = (file.name?.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4'
  const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const r = ref(storage(), `${pathPrefix}/${name}`)
  try {
    await withTimeout(
      uploadBytes(r, file, { contentType: file.type, cacheControl: 'public,max-age=31536000' }),
      VIDEO_UPLOAD_TIMEOUT_MS,
      'Upload timed out',
    )
  } catch (err) {
    if (isPermanent(err)) {
      throw new Error('Video storage is not set up yet for this app')
    }
    throw err
  }
  return await withTimeout(getDownloadURL(r), UPLOAD_TIMEOUT_MS, 'Upload timed out')
}
