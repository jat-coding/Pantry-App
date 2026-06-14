import { CATEGORIES, getCategories } from '../lib/categories.js'
import { SearchIcon } from './icons.jsx'

export function SearchBar({ value, onChange, placeholder = 'Search recipes or ingredients…' }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-800">
        <SearchIcon className="h-5 w-5" />
      </span>
      <input
        className="input pl-11"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-soft hover:text-warm"
          aria-label="Clear search"
        >
          ✕
        </button>
      )}
    </div>
  )
}

// Multi-select category filter. `selected` is an array; empty means "All".
export function CategoryFilter({ selected = [], onToggle, onClear }) {
  const cls = (active) =>
    `whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition active:scale-95 ${
      active ? 'bg-peach text-warm shadow-card' : 'bg-white text-warm-soft hover:bg-eggshell'
    }`
  return (
    <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-1">
      <button onClick={onClear} className={cls(selected.length === 0)}>All</button>
      {CATEGORIES.map((c) => {
        const active = selected.includes(c)
        return (
          <button key={c} onClick={() => onToggle(c)} className={cls(active)}>
            {active ? '✓ ' : ''}{c}
          </button>
        )
      })}
    </div>
  )
}

// True if a recipe matches the selected categories (empty selection = all).
export function matchesCategories(recipe, selected = []) {
  if (!selected.length) return true
  return getCategories(recipe).some((c) => selected.includes(c))
}

// Shared filtering helper: matches recipe by name OR ingredient name.
export function matchesQuery(recipe, q) {
  if (!q) return true
  const needle = q.toLowerCase()
  if (recipe.title?.toLowerCase().includes(needle)) return true
  return (recipe.ingredients || []).some((i) => i.name?.toLowerCase().includes(needle))
}
