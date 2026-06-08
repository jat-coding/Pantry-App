// Line-style tab + UI icons (no emojis). All use currentColor so they inherit
// the active/inactive text color from the nav.

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
  // Shelf silhouette with cans on it.
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">
      <path d="M3 9.5h18" />
      <path d="M3 17.5h18" />
      <rect x="5.8" y="5" width="3.2" height="4.5" rx="0.8" />
      <rect x="10.4" y="5" width="3.2" height="4.5" rx="0.8" />
      <rect x="15" y="5" width="3.2" height="4.5" rx="0.8" />
      <rect x="8" y="13" width="3.2" height="4.5" rx="0.8" />
      <rect x="12.8" y="13" width="3.2" height="4.5" rx="0.8" />
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
