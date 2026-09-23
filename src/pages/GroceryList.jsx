import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../contexts/DataContext.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../components/Toast.jsx'
import { Check, X } from 'lucide-react'
import { AISLE_ORDER, aisleFor } from '../lib/categories.js'
import { formatQty, abbreviateUnit } from '../lib/scaling.js'
import * as fs from '../lib/firestore.js'
import RecipeCard from '../components/RecipeCard.jsx'
import { GroceryIcon, TrashIcon } from '../components/icons.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'

export default function GroceryList() {
  const { grocery, recipes, addGroceryItems, setGroceryChecked, deleteGroceryItem, clearGrocery, canWrite } = useData()
  const toast = useToast()
  const [mode, setMode] = useState('list') // 'list' | 'find'
  const [confirming, setConfirming] = useState(null) // 'completed' | 'all' | null
  const [newItem, setNewItem] = useState('')
  const [newQty, setNewQty] = useState('')
  const [newUnit, setNewUnit] = useState('')

  // Combine duplicate items (same name+unit) by summing quantities.
  const combined = useMemo(() => combineItems(grocery), [grocery])
  const grouped = useMemo(() => {
    const g = {}
    for (const item of combined) {
      const aisle = item.category || aisleFor(item.name)
      ;(g[aisle] ||= []).push(item)
    }
    return g
  }, [combined])

  async function addManual() {
    if (!newItem.trim() || !canWrite) return
    const q = newQty.trim() === '' ? null : Number(newQty)
    await addGroceryItems([{
      name: newItem.trim(),
      qty: Number.isFinite(q) ? q : null,
      unit: newUnit.trim(),
      category: aisleFor(newItem),
    }])
    setNewItem(''); setNewQty(''); setNewUnit('')
    toast('Added to grocery list')
  }

  return (
    <div className="animate-fadein space-y-5">
      <header>
        <h1 className="text-3xl font-extrabold">Grocery List</h1>
        <p className="text-warm-soft">Everything you need for your next cook.</p>
      </header>

      <div className="flex rounded-2xl bg-white p-1">
        <button onClick={() => setMode('list')}
          className={`flex-1 rounded-xl py-2 text-sm font-bold ${mode === 'list' ? 'bg-peach text-warm' : 'text-warm-soft'}`}>
          Shopping List
        </button>
        <button onClick={() => setMode('find')}
          className={`flex-1 rounded-xl py-2 text-sm font-bold ${mode === 'find' ? 'bg-peach text-warm' : 'text-warm-soft'}`}>
          What Can I Make?
        </button>
      </div>

      {mode === 'find' ? (
        <WhatCanIMake recipes={recipes} />
      ) : (
        <>
          <div className="space-y-2">
            <div className="flex gap-2">
              <input className="input w-16 px-2 text-center" placeholder="Qty" value={newQty}
                onChange={(e) => setNewQty(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addManual()} />
              <input className="input w-20 px-2" placeholder="unit" value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addManual()} />
              <input className="input flex-1" placeholder="Add an item…" value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addManual()} />
            </div>
            <button className="btn-peach w-full" onClick={addManual}>Add to list</button>
          </div>

          {combined.length === 0 ? (
            <div className="card px-6 py-16 text-center">
              <div className="mb-2 flex justify-center text-zinc-800"><GroceryIcon className="h-12 w-12" /></div>
              <p className="font-bold">Your list is empty</p>
              <p className="text-sm text-warm-soft">Add items, or tap “Add to Grocery List” on any recipe.</p>
            </div>
          ) : (
            <>
              {AISLE_ORDER.filter((a) => grouped[a]?.length).map((aisle) => (
                <section key={aisle}>
                  <h2 className="mb-1 text-sm font-extrabold uppercase tracking-wide text-warm-soft">{aisle}</h2>
                  <ul className="card divide-y divide-warm/5 overflow-hidden">
                    {grouped[aisle].map((item) => (
                      <li key={item.ids.join(',')} className="flex items-center gap-3 p-3">
                        <button
                          onClick={() => item.ids.forEach((id) => setGroceryChecked(id, !item.checked))}
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${
                            item.checked ? 'border-peach-dark bg-peach-dark text-white' : 'border-warm/30'
                          }`}
                        >{item.checked ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" /> : ''}</button>
                        <div className={`flex-1 ${item.checked ? 'text-warm-soft line-through' : ''}`}>
                          <span className="font-bold">
                            {item.qty != null && `${formatQty(item.qty)} `}{item.unit && `${abbreviateUnit(item.unit)} `}{item.name}
                          </span>
                          {item.fromRecipe && (
                            item.fromRecipeId ? (
                              <Link to={`/recipe/${item.fromRecipeId}`} className="ml-1 text-xs font-bold text-cta underline-offset-2 hover:underline">
                                · {item.fromRecipe}
                              </Link>
                            ) : (
                              <span className="ml-1 text-xs text-warm-soft">· {item.fromRecipe}</span>
                            )
                          )}
                        </div>
                        <button onClick={() => item.ids.forEach(deleteGroceryItem)}
                          className="px-2 text-warm-soft hover:text-red-600" aria-label="Delete"><TrashIcon className="h-5 w-5" /></button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}

              <div className="flex gap-3 pt-2">
                <button className="btn-ghost flex-1" onClick={() => setConfirming('completed')}>
                  Clear Completed
                </button>
                <button className="btn-ghost flex-1" onClick={() => setConfirming('all')}>
                  Clear All
                </button>
              </div>
            </>
          )}
        </>
      )}

      {confirming && (
        <ConfirmDialog
          message={confirming === 'all' ? 'Clear the entire list?' : 'Clear completed items?'}
          confirmLabel="Clear"
          danger
          onConfirm={() => { clearGrocery(confirming === 'completed'); setConfirming(null) }}
          onCancel={() => setConfirming(null)}
        />
      )}
    </div>
  )
}

function combineItems(items) {
  const map = new Map()
  for (const it of items) {
    // Normalize name (case/whitespace) and unit (spelling) so "2 Tablespoon"
    // and "1 tbsp" of the same thing merge into one line.
    const name = (it.name || '').toLowerCase().trim().replace(/\s+/g, ' ')
    const unit = abbreviateUnit(it.unit).toLowerCase()
    const key = `${name}|${unit}`
    if (map.has(key)) {
      const ex = map.get(key)
      ex.qty = ex.qty != null && it.qty != null ? ex.qty + it.qty : ex.qty ?? it.qty
      ex.ids.push(it.id)
      ex.checked = ex.checked && it.checked
      if (!ex.fromRecipe && it.fromRecipe) { ex.fromRecipe = it.fromRecipe; ex.fromRecipeId = it.fromRecipeId }
    } else {
      map.set(key, { ...it, ids: [it.id] })
    }
  }
  return [...map.values()]
}

// Rank recipes by how many of the given ingredients they use.
function rankByPantry(recipes, pills) {
  return recipes
    .map((r) => {
      const names = (r.ingredients || []).map((i) => (i.name || '').toLowerCase())
      const have = pills.filter((p) => names.some((n) => n.includes(p)))
      const missing = names.length - have.length
      return { recipe: r, have: have.length, total: names.length, missing }
    })
    .filter((x) => x.have > 0)
    .sort((a, b) => b.have - a.have || a.missing - b.missing)
}

// Reverse recipe search — Layer 1 (own library) + Layer 2 (friends' recipes).
function WhatCanIMake({ recipes }) {
  const { profile } = useAuth()
  const { pocketRecipe, togglePantry } = useData()
  const toast = useToast()
  const [pills, setPills] = useState([])
  const [draft, setDraft] = useState('')
  const [results, setResults] = useState(null)
  const [friendResults, setFriendResults] = useState(null)
  const [friendRecipes, setFriendRecipes] = useState([])

  // Load friends' recipes once so we can suggest dishes you could pocket.
  useEffect(() => {
    let alive = true
    const ids = profile?.friendIds || []
    if (!ids.length) { setFriendRecipes([]); return }
    ;(async () => {
      const all = []
      for (const id of ids) {
        try { all.push(...(await fs.getFriendRecipes(id))) } catch { /* ignore one friend */ }
      }
      if (alive) setFriendRecipes(all)
    })()
    return () => { alive = false }
  }, [profile?.friendIds])

  function addPill() {
    const v = draft.trim().toLowerCase()
    if (v && !pills.includes(v)) setPills([...pills, v])
    setDraft('')
  }

  function findRecipes() {
    if (!pills.length) return
    setResults(rankByPantry(recipes, pills))
    setFriendResults(rankByPantry(friendRecipes, pills))
  }

  async function copyToPantry(recipe) {
    try {
      const newId = await pocketRecipe(recipe)
      await togglePantry(newId)
      toast('Copied to your Pantry')
    } catch {
      toast('Could not copy recipe')
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-warm-soft">Add ingredients you have — we’ll rank recipes you can make.</p>
      <div className="flex gap-2">
        <input className="input" placeholder="e.g. eggs" value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addPill()} />
        <button className="btn-ghost px-4" onClick={addPill}>Add</button>
      </div>
      {pills.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pills.map((p) => (
            <span key={p} className="pill-peach gap-1">
              {p}
              <button onClick={() => setPills(pills.filter((x) => x !== p))} aria-label="Remove"><X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" /></button>
            </span>
          ))}
        </div>
      )}
      <button className="btn-peach w-full" onClick={findRecipes} disabled={!pills.length}>Find Recipes</button>

      {results && (
        <div className="space-y-6">
          <section className="space-y-4">
            <h3 className="text-sm font-extrabold uppercase tracking-wide text-warm-soft">From your library</h3>
            {results.length === 0 ? (
              <p className="py-4 text-center text-warm-soft">No matches in your library yet.</p>
            ) : (
              results.map(({ recipe, have, total }) => (
                <div key={recipe.id}>
                  <p className="mb-1 text-sm font-bold text-warm-soft">
                    You have {have}/{total} ingredients ({Math.round((have / total) * 100)}%)
                  </p>
                  <RecipeCard recipe={recipe} />
                </div>
              ))
            )}
          </section>

          {friendResults && friendResults.length > 0 && (
            <section className="space-y-4">
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-warm-soft">From your friends</h3>
              {friendResults.map(({ recipe, have, total }) => (
                <div key={recipe.id}>
                  <p className="mb-1 text-sm font-bold text-warm-soft">
                    You have {have}/{total} ingredients ({Math.round((have / total) * 100)}%)
                  </p>
                  <RecipeCard recipe={recipe} showPocket pocketLabel="Copy to Pantry" onPocket={copyToPantry} />
                </div>
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  )
}
