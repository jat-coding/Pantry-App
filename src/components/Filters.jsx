import { CATEGORIES } from '../lib/categories.js'

export function SearchBar({ value, onChange, placeholder = 'Search recipes or ingredients…' }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-warm-soft">🔍</span>
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

export function CategoryFilter({ selected, onSelect }) {
  const items = ['All', ...CATEGORIES]
  return (
    <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-1">
      {items.map((c) => {
        const active = selected === c
        return (
          <button
            key={c}
            onClick={() => onSelect(c)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition active:scale-95 ${
              active ? 'bg-peach text-warm shadow-card' : 'bg-white text-warm-soft hover:bg-eggshell'
            }`}
          >
            {c}
          </button>
        )
      })}
    </div>
  )
}

// Shared filtering helper: matches recipe by name OR ingredient name.
export function matchesQuery(recipe, q) {
  if (!q) return true
  const needle = q.toLowerCase()
  if (recipe.title?.toLowerCase().includes(needle)) return true
  return (recipe.ingredients || []).some((i) => i.name?.toLowerCase().includes(needle))
}
