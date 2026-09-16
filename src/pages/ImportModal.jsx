import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../components/Toast.jsx'
import { normalizeRecipeImage, normalizeRecipePdf, normalizeRecipeText, normalizeRecipeVideo, fetchVideoMeta, fetchPageViaBridge } from '../lib/anthropic.js'
import { extractRecipeFromHtml } from '../lib/jsonld.js'
import { docxToText } from '../lib/docx.js'
import { useScrollLock } from '../lib/useScrollLock.js'
import { sanitizeRecipe } from '../lib/recipeShape.js'
import { LinkIcon, VideoIcon, EditIcon, CameraIcon } from '../components/icons.jsx'

const DRAFT_KEY = 'pantry-draft-new'

const TABS = [
  { id: 'url', label: 'URL', Icon: LinkIcon },
  { id: 'video', label: 'Video', Icon: VideoIcon },
  { id: 'text', label: 'Paste', Icon: EditIcon },
  { id: 'file', label: 'File', Icon: CameraIcon },
]

// What the File tab accepts. Word (.doc) and Pages files aren't readable — they
// are matched only so we can say so instead of failing with a vague error.
const FILE_ACCEPT = 'image/*,application/pdf,.pdf,.docx'

// Vercel caps a serverless request body at ~4.5 MB, and base64 adds ~33%, so a
// PDF has to stay meaningfully under that. Photos are downscaled before upload
// and never come close.
const MAX_PDF_BYTES = 3 * 1024 * 1024

function fileKind(file) {
  const name = (file?.name || '').toLowerCase()
  const type = file?.type || ''
  if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf'
  if (name.endsWith('.docx')) return 'docx'
  if (type.startsWith('image/')) return 'image'
  if (name.endsWith('.doc')) return 'legacy-doc'
  if (name.endsWith('.pages')) return 'pages'
  return 'unknown'
}

// Links where the recipe lives in a post/video description rather than a recipe
// page (Instagram, TikTok, YouTube, Facebook). These go through the video path.
function isVideoLink(url) {
  return /(instagram\.com|tiktok\.com|youtube\.com|youtu\.be|facebook\.com|fb\.watch)/i.test(url || '')
}

// Turns a bridge check-in into what the bar shows. `progress` and `etaMs` come from
// the Mac doing the work — real yt-dlp/whisper percentages where they exist, and an
// ETA learned from how long recent jobs of the same kind actually took — so this only
// formats; it doesn't guess.
function progressFromCheckIn({ progress, etaMs }) {
  const pct = Math.round(Math.min(98, Math.max(2, (progress || 0) * 100)))
  const secs = Math.ceil((etaMs || 0) / 1000)
  const remainingLabel = secs > 90 ? `~${Math.round(secs / 60)} min left`
    : secs > 3 ? `~${secs}s left`
    : 'almost done…'
  return { pct, remainingLabel }
}

// A recipe is only worth saving if it has a title, ingredients AND steps.
// Returns a human reason when something's missing so the user knows why, and we
// never create a half-empty recipe.
function unusableReason(r) {
  if (!r || !r.title || !String(r.title).trim()) return 'no recipe title was found'
  if (!Array.isArray(r.ingredients) || !r.ingredients.length) return 'no ingredients were found'
  if (!Array.isArray(r.instructions) || !r.instructions.length) return 'no steps/instructions were found'
  return null
}

// Build a rich text payload from a fetched page for Claude: JSON-LD blocks +
// og/meta description + visible text. Recipe sites usually embed the full
// recipe in ld+json even when the page is JS-rendered.
function pageToText(html) {
  const ld = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1]).join('\n')
  const metas = [...html.matchAll(/<meta[^>]+content=["']([^"']+)["'][^>]*>/gi)]
    .map((m) => m[1]).filter((c) => c && c.length > 30).join('\n')
  const visible = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return `${metas}\n\n${ld}\n\n${visible}`.slice(0, 24000)
}

export default function ImportModal({ onClose, initialUrl = '' }) {
  useScrollLock()
  const navigate = useNavigate()
  const toast = useToast()
  const [tab, setTab] = useState('url')
  const [url, setUrl] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  // True only when a video's description/caption didn't have the recipe —
  // the one failure the direct-read fallback can actually help with.
  const [offerDeepRead, setOfferDeepRead] = useState(false)
  // { pct, remainingLabel } while a video job is polling; null otherwise.
  const [progress, setProgress] = useState(null)
  const autoRan = useRef(false)
  // The video's own thumbnail (inline JPEG from the bridge), kept from the metadata
  // read so the deep-read fallback can reuse it without fetching it again.
  const thumbnailRef = useRef(null)

  // When opened from a shared link (iOS Shortcut / Android share target), prefill
  // the right tab and start the import automatically.
  useEffect(() => {
    if (!initialUrl || autoRan.current) return
    autoRan.current = true
    const video = isVideoLink(initialUrl)
    if (video) { setTab('video'); setVideoUrl(initialUrl) }
    else { setTab('url'); setUrl(initialUrl) }
    importFromUrl(initialUrl, { video })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUrl])

  // Show a failure as both an inline message (persists) and a toast (notifies),
  // so the user always knows the import didn't work and isn't left waiting.
  function fail(message, { deepReadable = false } = {}) {
    setError(message)
    setOfferDeepRead(deepReadable)
    toast('Import failed — see details')
  }

  function handoffToEditor(recipe) {
    // Importers (Claude paste/photo, JSON-LD, video) can return missing/null
    // fields or wrong types. Normalize to the exact shape the editor expects so
    // it never crashes to a blank screen on render.
    const safe = sanitizeRecipe(recipe)
    if (!safe.imageUrl && thumbnailRef.current) safe.imageUrl = thumbnailRef.current
    localStorage.setItem(DRAFT_KEY, JSON.stringify(safe))
    onClose()
    navigate('/new')
    toast('Review your imported recipe')
  }

  // Fetch a page through our proxy and turn it into a recipe. For non-video
  // pages we try fast structured (JSON-LD) extraction first, then fall back to
  // letting Claude read the whole page.
  async function importFromUrl(rawUrl, { video } = {}) {
    const target = (rawUrl || '').trim()
    if (!target) return
    setBusy(true); setError(''); setOfferDeepRead(false); setProgress(null); setStatus('Fetching page…')
    thumbnailRef.current = null
    try {
      // Every video platform (YouTube, TikTok, Instagram, Facebook) exposes a
      // title/description via yt-dlp's own metadata read, which beats scraping
      // the rendered page — no bot-check wall, and no navigation/comment noise
      // competing with the actual caption text.
      if (video) {
        await importFromVideoMeta(target)
        return
      }
      // Fetched through the same Mac-routed bridge as video, not directly from
      // this Vercel function — a slow site can't get cut off by Vercel's own
      // timeout ceiling either way.
      const html = await fetchPageViaBridge(target, {
        onProgress: (c) => setProgress(progressFromCheckIn(c)),
      })
      setProgress(null)

      setStatus('Reading recipe…')
      let recipe = extractRecipeFromHtml(html)
      if (unusableReason(recipe)) {
        setStatus('Asking Claude to read the page…')
        recipe = await normalizeRecipeText(pageToText(html))
      }
      const reason = unusableReason(recipe)
      if (reason) {
        throw new Error(`Couldn't build a complete recipe — ${reason}. Try the Paste tab with the full recipe text.`)
      }
      handoffToEditor(recipe)
    } catch (err) {
      fail(err.message || 'Import failed', { deepReadable: !!err.deepReadable })
    } finally {
      setBusy(false); setStatus(''); setProgress(null)
    }
  }

  // Fallback for a video whose description/caption didn't have the recipe:
  // actually download it and read its audio + on-screen frames. Much slower
  // (~1-2 min) and heavier, so it's an explicit second step, never the default.
  async function deepVideoImport() {
    setBusy(true); setError(''); setStatus('Downloading and transcribing the video…')
    setProgress({ pct: 2, remainingLabel: 'starting…' })
    try {
      const recipe = await normalizeRecipeVideo(videoUrl.trim(), {
        onProgress: (c) => setProgress(progressFromCheckIn(c)),
      })
      const reason = unusableReason(recipe)
      if (reason) throw new Error(`Couldn't build a complete recipe from the video itself — ${reason}.`)
      handoffToEditor(recipe)
    } catch (err) {
      fail(err.message || 'Could not read that video')
    } finally {
      setBusy(false); setStatus(''); setProgress(null)
    }
  }

  // Title + description straight from the video's own metadata (any of
  // youtube/tiktok/instagram/facebook — same bridge-routed read for all of
  // them). If the recipe isn't written there it simply isn't available this
  // way — a purely-spoken/on-screen recipe needs the deep-read fallback.
  async function importFromVideoMeta(url) {
    setStatus('Reading video details…')
    const meta = await fetchVideoMeta(url, {
      onProgress: (c) => setProgress(progressFromCheckIn(c)),
    })
    setProgress(null)
    thumbnailRef.current = meta.thumbnail || null

    const description = (meta.description || '').trim()
    // A bare link tree or "recipe on my website" blurb is not a recipe; require
    // enough text that there's plausibly a method in there.
    if (description.length < 120) {
      const e = new Error('This video’s description doesn’t include the recipe.')
      e.deepReadable = true
      throw e
    }

    setStatus('Asking Claude to read the recipe…')
    const recipe = await normalizeRecipeText(
      `VIDEO TITLE: ${meta.title || ''}\n\nVIDEO DESCRIPTION:\n${description}`,
    )
    const reason = unusableReason(recipe)
    if (reason) {
      const e = new Error(`Couldn't build a complete recipe — ${reason}. The description may only summarise the dish.`)
      e.deepReadable = true
      throw e
    }
    handoffToEditor(recipe)
  }

  async function importText() {
    if (!text.trim()) return
    setBusy(true); setError(''); setStatus('Asking Claude to parse…')
    try {
      const recipe = await normalizeRecipeText(text.trim())
      const reason = unusableReason(recipe)
      if (reason) throw new Error(`Couldn't build a complete recipe — ${reason}. Add the missing details and try again.`)
      handoffToEditor(recipe)
    } catch (err) {
      fail(err.message || 'Could not parse recipe')
    } finally {
      setBusy(false); setStatus('')
    }
  }

  // One picker for photos, PDFs, and Word docs — each goes to the importer that
  // can actually read it.
  async function importFile(file) {
    if (!file) return
    const kind = fileKind(file)
    setBusy(true); setError('')
    try {
      let recipe
      if (kind === 'pdf') {
        if (file.size > MAX_PDF_BYTES) {
          throw new Error('That PDF is too large (max 3 MB). Try exporting just the recipe pages.')
        }
        setStatus('Reading PDF…')
        const base64 = await fileToBase64(file)
        setStatus('Asking Claude to read the recipe…')
        recipe = await normalizeRecipePdf(base64)
      } else if (kind === 'docx') {
        setStatus('Reading document…')
        const text = await docxToText(file)
        setStatus('Asking Claude to read the recipe…')
        recipe = await normalizeRecipeText(text)
      } else if (kind === 'image') {
        setStatus('Reading photo…')
        const base64 = await fileToBase64(file)
        setStatus('Asking Claude to read the recipe…')
        recipe = await normalizeRecipeImage(base64, file.type || 'image/jpeg')
      } else if (kind === 'legacy-doc') {
        throw new Error('Older .doc files aren’t supported. Open it in Word and save as .docx.')
      } else if (kind === 'pages') {
        throw new Error('Pages files aren’t supported. Export it as a PDF or Word document first.')
      } else {
        throw new Error('Unsupported file. Choose a photo, PDF, or Word (.docx) document.')
      }

      const reason = unusableReason(recipe)
      if (reason) {
        throw new Error(
          kind === 'image'
            ? `Couldn't build a complete recipe — ${reason}. Make sure the whole recipe is visible and in focus.`
            : `Couldn't build a complete recipe — ${reason}. Check the file contains the full recipe.`,
        )
      }
      handoffToEditor(recipe)
    } catch (err) {
      fail(err.message || 'Could not read that file')
    } finally {
      setBusy(false); setStatus('')
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-warm/40 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-md animate-fadein overflow-y-auto overscroll-contain rounded-t-3xl bg-eggshell p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-extrabold">Import a Recipe</h2>
          <button onClick={onClose} className="text-2xl text-warm-soft" aria-label="Close"><X className="h-6 w-6" strokeWidth={2} aria-hidden="true" /></button>
        </div>

        <div className="mb-4 flex rounded-2xl bg-white p-1">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => { setTab(t.id); setError(''); setOfferDeepRead(false) }}
              className={`flex flex-1 items-center justify-center gap-1 rounded-xl py-2 text-sm font-bold transition ${
                tab === t.id ? 'bg-peach text-warm' : 'text-warm-soft'
              }`}>
              <t.Icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'url' && (
          <div className="space-y-3">
            <p className="text-sm text-warm-soft">Paste a link from AllRecipes, NYT Cooking, Traeger, and more.</p>
            <input className="input" placeholder="https://…" value={url}
              onChange={(e) => setUrl(e.target.value)} />
            <button className="btn-peach w-full" disabled={busy} onClick={() => importFromUrl(url)}>
              {busy && !progress ? status || 'Working…' : 'Import from URL'}
            </button>
            <ProgressBar busy={busy} status={status} progress={progress} />
          </div>
        )}

        {tab === 'video' && (
          <div className="space-y-3">
            <p className="text-sm text-warm-soft">
              Paste a cooking video link — YouTube, TikTok, Instagram, or Facebook. Claude
              reads the video's caption/description to build the recipe first; if that
              doesn't have it, you can have Pantry watch and listen to the video itself.
            </p>
            <input className="input" placeholder="https://…" value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)} />
            <button className="btn-peach w-full" disabled={busy} onClick={() => importFromUrl(videoUrl, { video: true })}>
              {busy && !progress ? status || 'Working…' : 'Import from Video'}
            </button>
            <ProgressBar busy={busy} status={status} progress={progress} />
            {offerDeepRead && (
              <button className="btn-ghost w-full" disabled={busy} onClick={deepVideoImport}>
                Read the video itself (slower, ~1-2 min)
              </button>
            )}
          </div>
        )}

        {tab === 'text' && (
          <div className="space-y-3">
            <p className="text-sm text-warm-soft">Paste any recipe text and Claude will structure it.</p>
            <textarea className="input min-h-[8rem]" placeholder="Paste recipe text here…"
              value={text} onChange={(e) => setText(e.target.value)} />
            <button className="btn-peach w-full" disabled={busy} onClick={importText}>
              {busy ? status || 'Working…' : 'Parse with Claude'}
            </button>
          </div>
        )}

        {tab === 'file' && (
          <div className="space-y-3">
            <p className="text-sm text-warm-soft">
              Snap a cookbook page or recipe card, or pick a photo, PDF, or Word document from your device.
            </p>
            <label className="flex min-h-[8rem] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-warm/25 bg-white text-warm-soft">
              <CameraIcon className="h-8 w-8 text-zinc-800" />
              <span className="font-bold">{busy ? status || 'Working…' : 'Choose a file'}</span>
              <span className="text-xs">Photo, PDF, or .docx</span>
              <input type="file" accept={FILE_ACCEPT} className="hidden" disabled={busy}
                onChange={(e) => importFile(e.target.files?.[0])} />
            </label>
          </div>
        )}

        {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
      </div>
    </div>
  )
}

function ProgressBar({ busy, status, progress }) {
  if (!busy || !progress) return null
  return (
    <div className="space-y-1">
      <p className="text-xs font-bold text-warm-soft">{status} — {progress.remainingLabel}</p>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-peach-dark transition-all duration-500"
          style={{ width: `${progress.pct}%` }} />
      </div>
    </div>
  )
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1]) // strip data: prefix
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
