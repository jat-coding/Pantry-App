import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  GroceryIcon, RecipesIcon, PantryIcon, FriendsIcon, ProfileIcon,
} from './icons.jsx'

// Order matters: Grocery sits far left, Pantry is centered (middle of 5).
const TABS = [
  { to: '/grocery', label: 'Grocery', Icon: GroceryIcon },
  { to: '/recipes', label: 'Recipes', Icon: RecipesIcon },
  { to: '/', label: 'Pantry', Icon: PantryIcon, end: true },
  { to: '/friends', label: 'Friends', Icon: FriendsIcon },
  { to: '/profile', label: 'Profile', Icon: ProfileIcon },
]

function OfflineBanner() {
  // Subtle "You're offline" banner driven by the browser's online state.
  const [offline, setOffline] = useState(!navigator.onLine)
  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  if (!offline) return null
  return (
    <div className="sticky top-0 z-50 bg-warm/90 py-1 text-center text-xs font-bold text-eggshell">
      You're offline — showing saved recipes
    </div>
  )
}

export default function Layout() {
  return (
    <div className="min-h-screen sm:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-warm/10 bg-white/60 px-4 py-6 backdrop-blur sm:flex">
        <div className="mb-8 flex items-center gap-2 px-2">
          <PantryIcon className="h-7 w-7 text-zinc-800" />
          <span className="text-xl font-extrabold">Pantry</span>
        </div>
        <nav className="flex flex-col gap-1">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-4 py-3 font-bold transition ${
                  isActive ? 'bg-peach text-warm' : 'text-warm-soft hover:bg-eggshell'
                }`
              }
            >
              <t.Icon className="h-6 w-6 text-zinc-800" />
              {t.label === 'Pantry' ? 'My Pantry' : t.label === 'Recipes' ? 'All Recipes' : t.label === 'Grocery' ? 'Grocery List' : t.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main content — top padding clears the Dynamic Island / status bar,
          bottom padding clears the fixed tab bar + home indicator. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <OfflineBanner />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-[calc(env(safe-area-inset-bottom)+6.5rem)] sm:px-8 sm:pt-5 sm:pb-10">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-warm/10 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 pb-1.5 pt-2 text-[10px] font-bold transition ${
                isActive ? 'text-warm' : 'text-warm-soft/70'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <t.Icon className={`h-6 w-6 text-zinc-800 transition ${isActive ? 'scale-110' : 'opacity-50'}`} />
                {t.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
