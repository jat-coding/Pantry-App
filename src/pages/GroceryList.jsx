import { useMemo, useState } from 'react'
import { useData } from '../contexts/DataContext.jsx'
import { useToast } from '../components/Toast.jsx'
import { AISLE_ORDER, aisleFor } from '../lib/categories.js'
import { formatQty } from '../lib/scaling.js'
import RecipeCard from '../components/RecipeCard.jsx'
import { GroceryIcon } from '../components/icons.jsx'

export default function GroceryList() {
  const { grocery, recipes, addGroceryItems, setGroceryChecked, deleteGroceryItem, clearGrocery, canWrite } = useData()
  const toast = useToast()
  const [mode, setMode] = useState('list') // 'list' | 'find'
  const [newItem, setNewItem] = useState('')

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
    await addGroceryItems([{ name: newItem.trim(), category: aisleFor(newItem) }])
    setNewItem('')
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
          <div className="flex gap-2">
            <input className="input" placeholder="Add an item…" value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addManual()} />
            <button className="btn-peach px-5" onClick={addManual}>Add</button>
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
                        >{item.checked ? '✓' : ''}</button>
                        <div className={`flex-1 ${item.checked ? 'text-warm-soft line-through' : ''}`}>
                          <span className="font-bold">
                            {item.qty != null && `${formatQty(item.qty)} `}{item.unit && `${item.unit} `}{item.name}
                          </span>
                          {item.fromRecipe && <span className="ml-1 text-xs text-warm-soft">· {item.fromRecipe}</span>}
                        </div>
                        <button onClick={() => item.ids.forEach(deleteGroceryItem)}
                          className="px-2 text-warm-soft hover:text-red-600" aria-label="Delete">🗑</button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}

              <div className="flex gap-3 pt-2">
                <button className="btn-ghost flex-1"
                  onClick={() => window.confirm('Clear completed items?') && clearGrocery(true)}>
                  Clear Completed
                </button>
                <button className="btn-ghost flex-1"
                  onClick={() => window.confirm('Clear the entire list?') && clearGrocery(false)}>
                  Clear All
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function combineItems(items) {
  const map = new Map()
  for (const it of items) {
    const key = `${(it.name || '').toLowerCase()}|${(it.unit || '').toLowerCase()}`
    if (map.has(key)) {
      const ex = map.get(key)
      ex.qty = ex.qty != null && it.qty != null ? ex.qty + it.qty : ex.qty ?? it.qty
      ex.ids.push(it.id)
      ex.checked = ex.checked && it.checked
      if (!ex.fromRecipe && it.fromRecipe) ex.fromRecipe = it.fromRecipe
    } else {
      map.set(key, { ...it, ids: [it.id] })
    }
  }
  return [...map.values()]
}

// Reverse recipe search — Layer 1 (own library).
function WhatCanIMake({ recipes }) {
  const [pills, setPills] = useState([])
  const [draft, setDraft] = useState('')
  const [results, setResults] = useState(null)

  function addPill() {
    const v = draft.trim().toLowerCase()
    if (v && !pills.includes(v)) setPills([...pills, v])
    setDraft('')
  }

  function findRecipes() {
    if (!pills.length) return
    const ranked = recipes
      .map((r) => {
        const names = (r.ingredients || []).map((i) => (i.name || '').toLowerCase())
        const have = pills.filter((p) => names.some((n) => n.includes(p)))
        const missing = names.length - have.length
        return { recipe: r, have: have.length, total: names.length, missing }
      })
      .filter((x) => x.have > 0)
      .sort((a, b) => b.have - a.have || a.missing - b.missing)
    setResults(ranked)
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
              <button onClick={() => setPills(pills.filter((x) => x !== p))} aria-label="Remove">×</button>
            </span>
          ))}
        </div>
      )}
      <button className="btn-peach w-full" onClick={findRecipes} disabled={!pills.length}>Find Recipes</button>

      {results && (
        results.length === 0 ? (
          <p className="py-8 text-center text-warm-soft">No matches in your library yet.</p>
        ) : (
          <div className="space-y-4">
            {results.map(({ recipe, have, total }) => (
              <div key={recipe.id}>
                <p className="mb-1 text-sm font-bold text-warm-soft">
                  You have {have}/{total} ingredients ({Math.round((have / total) * 100)}%)
                </p>
                <RecipeCard recipe={recipe} />
              </div>
            ))}
            {/* Layer 2 (friends' public recipes) plugs in here — query friends'
                public recipes and show a "Pocket this recipe" action on matches. */}
          </div>
        )
      )}
    </div>
  )
}
