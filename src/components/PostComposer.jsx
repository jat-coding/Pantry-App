import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useData } from '../contexts/DataContext.jsx'
import { useToast } from './Toast.jsx'
import SafeImage from './SafeImage.jsx'
import { CameraIcon, CategoryIcon } from './icons.jsx'
import { CATEGORIES, primaryCategory } from '../lib/categories.js'
import { CAPTION_MAX, matchesRecipeSearch } from '../lib/socialFeed.js'
import { uploadImage } from '../lib/storage.js'
import { useScrollLock } from '../lib/useScrollLock.js'
import { useStandaloneBottomGap } from '../lib/useStandaloneBottomGap.js'
import * as fs from '../lib/firestore.js'

// Recipes whose stored category isn't one of CATEGORIES land here. Matches Pantry.jsx.
const OTHER = 'Other'

// The Post button's second step: the photo is already picked (Friends.jsx). Exactly
// three inputs (his spec, v1.39.3): the photo, an optional caption, and one of my own
// recipes to link. The caption box sits right under the photo, where it shows on the
// feed card; the recipe list is last because it is long. The photo is uploaded only on Post, into my
// own Storage folder, and belongs to the post alone -- the recipe's own photo is never
// touched (his tap answer).
export default function PostComposer({ file, onChangeFile, onClose, onPosted }) {
  const { user, profile } = useAuth()
  const { recipes } = useData()
  const toast = useToast()
  const bottomGap = useStandaloneBottomGap()
  useScrollLock()

  const [preview, setPreview] = useState('')
  useEffect(() => {
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  // Search as you type, same beat as the friend search on the Social tab; no server
  // round trip, the recipes are already loaded.
  const [term, setTerm] = useState('')
  const [query, setQuery] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setQuery(term), 300)
    return () => clearTimeout(t)
  }, [term])

  const [selectedId, setSelectedId] = useState(null)
  const [posting, setPosting] = useState(false)
  const [caption, setCaption] = useState('')
  const selected = recipes.find((r) => r.id === selectedId) || null

  // One section per category, in CATEGORIES order (same grouping as My Pantry), each
  // filtered by the search across every category.
  const sections = useMemo(() => {
    const order = [...CATEGORIES, OTHER]
    const byCat = new Map(order.map((c) => [c, []]))
    for (const r of recipes) {
      if (!matchesRecipeSearch(r, query)) continue
      const p = primaryCategory(r)
      byCat.get(CATEGORIES.includes(p) ? p : OTHER).push(r)
    }
    return [...byCat]
      .filter(([, list]) => list.length > 0)
      .map(([category, list]) => ({
        category,
        list: [...list].sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''))),
      }))
  }, [recipes, query])

  async function post() {
    if (!selected || posting) return
    setPosting(true)
    try {
      const imageUrl = await uploadImage(file, `recipes/${user.uid}/posts`)
      await fs.createPost({ recipe: selected, imageUrl, caption }, user, profile?.displayName)
      toast('Posted to your feed')
      onPosted()
    } catch {
      toast('Could not post. Try again.')
      setPosting(false)
    }
  }

  // Portaled to <body> for the same reason as FriendProfile's overlay: a fixed overlay
  // inside the page's fade-in animation would behave like `absolute` on some phones.
  return createPortal(
    <div className="fixed inset-0 z-[70] overflow-y-auto overscroll-contain bg-eggshell" style={{ bottom: -bottomGap }}
      role="dialog" aria-label="New post">
      <header className="sticky top-0 z-10 border-b border-warm/10 bg-eggshell/95 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
          <button onClick={onClose} className="font-bold text-warm-soft" disabled={posting}>Cancel</button>
          <span className="font-extrabold">New Post</span>
          <button onClick={post} className="btn-peach px-4 py-2 text-sm disabled:opacity-60" disabled={!selected || posting}>
            {posting ? 'Posting…' : 'Post'}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <div className="relative overflow-hidden rounded-2xl bg-white shadow-card">
          {preview && <img src={preview} alt="Your post photo" className="aspect-[4/3] w-full object-cover" />}
          <label className={`absolute right-2 top-2 flex cursor-pointer items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-warm shadow-card ${posting ? 'pointer-events-none opacity-60' : ''}`}>
            <CameraIcon className="h-4 w-4" /> Change photo
            <input type="file" accept="image/*" className="hidden" disabled={posting}
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onChangeFile(f) }} />
          </label>
        </div>

        <div>
          <label htmlFor="post-caption" className="mb-2 flex items-baseline justify-between gap-2">
            <span className="text-lg font-extrabold">Caption</span>
            <span className="text-xs font-bold text-warm-soft">Optional</span>
          </label>
          <textarea id="post-caption" className="input min-h-[5.5rem] resize-none leading-snug" rows={3}
            placeholder="Say something about what you made…" maxLength={CAPTION_MAX}
            value={caption} onChange={(e) => setCaption(e.target.value)} disabled={posting} />
        </div>

        <div>
          <h2 className="mb-2 text-lg font-extrabold">Recipe</h2>
          {selected && (
            <p className="mb-2 text-sm text-warm-soft">Selected: <span className="font-bold text-warm">{selected.title}</span></p>
          )}
          <input className="input" placeholder="Search your recipes…" value={term}
            onChange={(e) => setTerm(e.target.value)} />
        </div>

        {recipes.length === 0 ? (
          <p className="text-sm text-warm-soft">You don't have any recipes yet. Add one first, then post it.</p>
        ) : sections.length === 0 ? (
          <p className="text-sm text-warm-soft">No recipes match "{query.trim()}".</p>
        ) : (
          sections.map(({ category, list }) => (
            <section key={category} data-category={category} className="space-y-2">
              <h3 className="flex items-center gap-2 font-extrabold">
                <CategoryIcon category={category} className="h-5 w-5 text-zinc-800" />
                {category}
                <span className="text-sm font-bold text-warm-soft">{list.length}</span>
              </h3>
              {list.map((r) => {
                const on = r.id === selectedId
                return (
                  <button key={r.id} data-recipe={r.id} onClick={() => setSelectedId(on ? null : r.id)} aria-pressed={on}
                    className={`card flex w-full items-center gap-3 p-2 text-left transition active:scale-[0.99] ${on ? 'ring-2 ring-cta' : ''}`}>
                    <SafeImage src={r.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover"
                      fallback={<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-eggshell">
                        <CategoryIcon category={category} className="h-5 w-5 text-warm-soft" />
                      </div>} />
                    <span className="min-w-0 flex-1 truncate font-bold">{r.title}</span>
                    {on && <Check className="h-5 w-5 shrink-0 text-cta" strokeWidth={2.5} aria-hidden="true" />}
                  </button>
                )
              })}
            </section>
          ))
        )}
      </div>
    </div>,
    document.body,
  )
}
