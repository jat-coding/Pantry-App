import { useState } from 'react'
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

// A parsed recipe must have at least a title and one ingredient to be useful.
function isUsable(r) {
  return !!(r && r.title && String(r.title).trim() && Array.isArray(r.ingredients) && r.ingredients.length)
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

export default function ImportModal({ onClose }) {
  const navigate = useNavigate()
  const toast = useToast()
  const [tab, setTab] = useState('url')
  const [url, setUrl] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

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
    const target = rawUrl.trim()
    if (!target) return
    setBusy(true); setError(''); setStatus('Fetching page…')
    try {
      const res = await fetch(`/api/recipe-proxy?url=${encodeURIComponent(target)}`)
      if (!res.ok) throw new Error('Could not open that link.')
      const html = await res.text()

      let recipe = null
      if (!video) {
        setStatus('Reading recipe…')
        recipe = extractRecipeFromHtml(html)
      }
      if (!isUsable(recipe)) {
        setStatus('Asking Claude to read the page…')
        recipe = await normalizeRecipeText(pageToText(html))
      }
      if (!isUsable(recipe)) {
        throw new Error(
          video
            ? "Couldn't find a recipe in that video's description."
            : "Couldn't read a recipe from that page. Try the Paste tab instead.",
        )
      }
      handoffToEditor(recipe)
    } catch (err) {
      setError(err.message || 'Import failed')
    } finally {
      setBusy(false); setStatus('')
    }
  }

  async function importText() {
    if (!text.trim()) return
    setBusy(true); setError(''); setStatus('Asking Claude to parse…')
    try {
      const recipe = await normalizeRecipeText(text.trim())
      if (!isUsable(recipe)) throw new Error("Couldn't find a recipe in that text.")
      handoffToEditor(recipe)
    } catch (err) {
      setError(err.message || 'Could not parse recipe')
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
      if (!isUsable(recipe)) throw new Error("Couldn't read a recipe from that photo.")
      handoffToEditor(recipe)
    } catch (err) {
      setError(err.message || 'Could not read photo')
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

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1]) // strip data: prefix
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
