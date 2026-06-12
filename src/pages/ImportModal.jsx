import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../components/Toast.jsx'
import { normalizeRecipeImage, normalizeRecipeText } from '../lib/anthropic.js'
import { extractRecipeFromHtml } from '../lib/jsonld.js'
import { sanitizeRecipe } from '../lib/recipeShape.js'
import { LinkIcon, VideoIcon, EditIcon, CameraIcon } from '../components/icons.jsx'

const DRAFT_KEY = 'pantry-draft-new'

const TABS = [
  { id: 'url', label: 'URL', Icon: LinkIcon },
  { id: 'video', label: 'Video', Icon: VideoIcon },
  { id: 'text', label: 'Paste', Icon: EditIcon },
  { id: 'photo', label: 'Photo', Icon: CameraIcon },
]

// Links where the recipe lives in a post/video description rather than a recipe
// page (Instagram, TikTok, YouTube, Facebook). These go through the video path.
function isVideoLink(url) {
  return /(instagram\.com|tiktok\.com|youtube\.com|youtu\.be|facebook\.com|fb\.watch)/i.test(url || '')
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
  const navigate = useNavigate()
  const toast = useToast()
  const [tab, setTab] = useState('url')
  const [url, setUrl] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const autoRan = useRef(false)

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
  function fail(message) {
    setError(message)
    toast('Import failed — see details')
  }

  function handoffToEditor(recipe) {
    // Importers (Claude paste/photo, JSON-LD, video) can return missing/null
    // fields or wrong types. Normalize to the exact shape the editor expects so
    // it never crashes to a blank screen on render.
    const safe = sanitizeRecipe(recipe)
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
    setBusy(true); setError(''); setStatus('Fetching page…')
    try {
      const res = await fetchWithTimeout(`/api/recipe-proxy?url=${encodeURIComponent(target)}`, 25000)
      if (!res.ok) throw new Error('Could not open that link. Check the URL and that the post is public.')
      const html = await res.text()

      let recipe = null
      if (!video) {
        setStatus('Reading recipe…')
        recipe = extractRecipeFromHtml(html)
      }
      if (unusableReason(recipe)) {
        setStatus('Asking Claude to read the page…')
        recipe = await normalizeRecipeText(pageToText(html))
      }
      const reason = unusableReason(recipe)
      if (reason) {
        throw new Error(
          video
            ? `Couldn't build a complete recipe — ${reason}. The post may not have the full recipe written in its caption (recipes shown only in the video can't be read).`
            : `Couldn't build a complete recipe — ${reason}. Try the Paste tab with the full recipe text.`,
        )
      }
      handoffToEditor(recipe)
    } catch (err) {
      fail(err.message || 'Import failed')
    } finally {
      setBusy(false); setStatus('')
    }
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

  async function importPhoto(file) {
    if (!file) return
    setBusy(true); setError(''); setStatus('Reading photo…')
    try {
      const base64 = await fileToBase64(file)
      setStatus('Asking Claude to read the recipe…')
      const recipe = await normalizeRecipeImage(base64, file.type || 'image/jpeg')
      const reason = unusableReason(recipe)
      if (reason) throw new Error(`Couldn't build a complete recipe — ${reason}. Make sure the whole recipe is visible and in focus.`)
      handoffToEditor(recipe)
    } catch (err) {
      fail(err.message || 'Could not read photo')
    } finally {
      setBusy(false); setStatus('')
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-warm/40 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div className="w-full max-w-md animate-fadein rounded-t-3xl bg-eggshell p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-extrabold">Import a Recipe</h2>
          <button onClick={onClose} className="text-2xl text-warm-soft" aria-label="Close">×</button>
        </div>

        <div className="mb-4 flex rounded-2xl bg-white p-1">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => { setTab(t.id); setError('') }}
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
              {busy ? status || 'Working…' : 'Import from URL'}
            </button>
          </div>
        )}

        {tab === 'video' && (
          <div className="space-y-3">
            <p className="text-sm text-warm-soft">
              Paste a cooking video link (YouTube, TikTok, Instagram…). Claude reads the
              video's description to build the recipe — works best when the recipe is written there.
            </p>
            <input className="input" placeholder="https://youtube.com/…" value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)} />
            <button className="btn-peach w-full" disabled={busy} onClick={() => importFromUrl(videoUrl, { video: true })}>
              {busy ? status || 'Working…' : 'Import from Video'}
            </button>
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

        {tab === 'photo' && (
          <div className="space-y-3">
            <p className="text-sm text-warm-soft">Snap a cookbook page, recipe card, or pick one from your camera roll.</p>
            <label className="flex min-h-[8rem] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-warm/25 bg-white text-warm-soft">
              <CameraIcon className="h-8 w-8 text-zinc-800" />
              <span className="font-bold">{busy ? status || 'Working…' : 'Choose a photo'}</span>
              <input type="file" accept="image/*" className="hidden" disabled={busy}
                onChange={(e) => importPhoto(e.target.files?.[0])} />
            </label>
          </div>
        )}

        {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
      </div>
    </div>
  )
}

// fetch with an abort timeout so the proxy step can't hang the import forever.
async function fetchWithTimeout(url, ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { signal: controller.signal })
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error('That link took too long to load.')
    throw new Error('Network error — check your connection and try again.')
  } finally {
    clearTimeout(timer)
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1]) // strip data: prefix
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
