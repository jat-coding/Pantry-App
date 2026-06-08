// Line-style icons (no emojis). All use currentColor so callers control color;
// across the app icons are rendered in a greyish-black (text-zinc-800).

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export function GroceryIcon({ className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <path d="M3 4h2l1.3 9.6a1.6 1.6 0 0 0 1.6 1.4h7.8a1.6 1.6 0 0 0 1.6-1.3L19.3 7H6" />
      <circle cx="9" cy="19" r="1.5" />
      <circle cx="17" cy="19" r="1.5" />
    </svg>
  )
}

export function RecipesIcon({ className = 'h-6 w-6' }) {
  // Open book.
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <path d="M12 6.2C10.4 5 8.4 4.3 6 4.3c-1 0-2 .12-3 .35v13c1-.23 2-.35 3-.35 2.4 0 4.4.7 6 1.9 1.6-1.2 3.6-1.9 6-1.9 1 0 2 .12 3 .35v-13c-1-.23-2-.35-3-.35-2.4 0-4.4.7-6 1.9z" />
      <path d="M12 6.2v12.7" />
    </svg>
  )
}

export function PantryIcon({ className = 'h-6 w-6' }) {
  // Pantry cabinet: outer frame with shelves and jars/cans on each shelf.
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M4 9h16M4 15h16" />
      {/* top shelf */}
      <rect x="6.4" y="4.6" width="2.6" height="3.6" rx="0.7" />
      <rect x="10.1" y="4.6" width="2.4" height="3.6" rx="0.7" />
      <rect x="13.6" y="4.6" width="3.6" height="3.6" rx="0.7" />
      {/* middle shelf */}
      <rect x="6.4" y="10.6" width="3.6" height="3.6" rx="0.7" />
      <rect x="11.1" y="10.6" width="2.4" height="3.6" rx="0.7" />
      <rect x="14.6" y="10.6" width="2.6" height="3.6" rx="0.7" />
      {/* bottom shelf */}
      <rect x="7" y="16.6" width="4" height="3.6" rx="0.7" />
      <rect x="12.5" y="16.6" width="4" height="3.6" rx="0.7" />
    </svg>
  )
}

export function FriendsIcon({ className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.3a3 3 0 0 1 0 5.4" />
      <path d="M15.6 13.8A5.5 5.5 0 0 1 20.5 19" />
    </svg>
  )
}

export function ProfileIcon({ className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <circle cx="12" cy="8" r="3.3" />
      <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
    </svg>
  )
}

export function GridIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <rect x="4" y="4" width="7" height="7" rx="1.4" />
      <rect x="13" y="4" width="7" height="7" rx="1.4" />
      <rect x="4" y="13" width="7" height="7" rx="1.4" />
      <rect x="13" y="13" width="7" height="7" rx="1.4" />
    </svg>
  )
}

export function ListIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <path d="M8 6h12M8 12h12M8 18h12" />
      <circle cx="4" cy="6" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="4" cy="18" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function SearchIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  )
}

export function MealIcon({ className = 'h-6 w-6' }) {
  // Fork + knife — placeholder when a recipe has no photo.
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <path d="M7 3v7a2 2 0 0 0 2 2v9M9 3v5M5 3v5a2 2 0 0 0 2 2" />
      <path d="M17 3c-1.7 0-3 2-3 4.5S15.3 12 17 12v9" />
    </svg>
  )
}

export function EditIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  )
}

export function TrashIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <path d="M4 7h16M10 4h4M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}

export function VideoIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="m16 10 5-3v10l-5-3z" />
    </svg>
  )
}

export function CameraIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  )
}

export function LinkIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <path d="M9 13a4 4 0 0 0 5.66 0l2.5-2.5a4 4 0 1 0-5.66-5.66L10.5 6" />
      <path d="M15 11a4 4 0 0 0-5.66 0l-2.5 2.5a4 4 0 1 0 5.66 5.66L13.5 18" />
    </svg>
  )
}

export function HeartIcon({ filled, className = 'h-5 w-5' }) {
  // Symmetric heart; filled uses the warm peach accent.
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 20.3l-1.36-1.24C5.9 14.75 3 12.12 3 8.86 3 6.27 5.04 4.25 7.62 4.25c1.46 0 2.86.68 3.78 1.76L12 6.62l.6-.61c.92-1.08 2.32-1.76 3.78-1.76C18.96 4.25 21 6.27 21 8.86c0 3.26-2.9 5.89-7.64 10.2L12 20.3z"
        fill={filled ? '#FFCBA4' : 'none'}
        stroke={filled ? '#F2A977' : 'currentColor'}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}
