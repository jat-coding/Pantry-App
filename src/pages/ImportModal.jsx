import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../components/Toast.jsx'
import { hasApiKey, normalizeRecipeImage, normalizeRecipeText } from '../lib/anthropic.js'
import { extractRecipeFromHtml } from '../lib/jsonld.js'

const DRAFT_KEY = 'pantry-draft-new'

const TABS = [
  { id: 'url', label: '🔗 URL' },
  { id: 'text', label: '📝 Paste' },
  { id: 'photo', label: '📷 Photo' },
]

export default function ImportModal({ onClose }) {
  const navigate = useNavigate()
  const toast = useToast()
  const [tab, setTab] = useState('url')
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  // On success, stash the parsed recipe as the editor draft and open the
  // editor as an editable preview before the user commits the save.
  function handoffToEditor(recipe) {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(recipe))
    onClose()
    navigate('/new')
    toast('Review your imported recipe ✨')
  }

  async function importUrl() {
    if (!url.trim()) return
    setBusy(true); setError(''); setStatus('Fetching page…')
    try {
      const res = await fetch(`/recipe-proxy?url=${encodeURIComponent(url.trim())}`)
      const html = await res.text()
      setStatus('Reading recipe…')
      let recipe = extractRecipeFromHtml(html)
      if (!recipe || !recipe.ingredients?.length) {
        // Fallback: let Claude read the page text.
        if (!hasApiKey()) throw new Error('No structured recipe found and no API key for fallback.')
        setStatus('Asking Claude to parse…')
        const stripped = html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ').slice(0, 12000)
        recipe = await normalizeRecipeText(stripped)
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
              className={`flex-1 rounded-xl py-2 text-sm font-bold transition ${
                tab === t.id ? 'bg-peach text-warm' : 'text-warm-soft'
              }`}>{t.label}</button>
          ))}
        </div>

        {tab === 'url' && (
          <div className="space-y-3">
            <p className="text-sm text-warm-soft">Paste a link from AllRecipes, NYT Cooking, Food Network, and more.</p>
            <input className="input" placeholder="https://…" value={url}
              onChange={(e) => setUrl(e.target.value)} />
            <button className="btn-peach w-full" disabled={busy} onClick={importUrl}>
              {busy ? status || 'Working…' : 'Import from URL'}
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
            <p className="text-sm text-warm-soft">Snap a cookbook page, recipe card, or handwritten note.</p>
            <label className="flex min-h-[8rem] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-warm/25 bg-white text-warm-soft">
              <span className="text-3xl">📷</span>
              <span className="font-bold">{busy ? status || 'Working…' : 'Choose a photo'}</span>
              <input type="file" accept="image/png,image/jpeg" className="hidden" disabled={busy}
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
