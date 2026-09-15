import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useData } from '../contexts/DataContext.jsx'
import { useCookMode } from '../contexts/CookModeContext.jsx'
import { useToast } from './Toast.jsx'
import ImportModal from '../pages/ImportModal.jsx'
import ScrollMemory from './ScrollMemory.jsx'
import {
  GroceryIcon, RecipesIcon, PantryIcon, FriendsIcon, ProfileIcon, PlusIcon, LinkIcon, EditIcon,
} from './icons.jsx'

// Bottom-bar order: Grocery, Recipes, [+ add], Pantry, Friends.
// Profile is reached from the top-right of the Friends screen.
const TABS = [
  { to: '/grocery', label: 'Grocery', Icon: GroceryIcon },
  { to: '/recipes', label: 'Recipes', Icon: RecipesIcon },
  { to: '/', label: 'Pantry', Icon: PantryIcon, end: true },
  { to: '/friends', label: 'Friends', Icon: FriendsIcon },
]

function OfflineBanner() {
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
  const navigate = useNavigate()
  const { canWrite } = useData()
  const { cookMode } = useCookMode()
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [sharedUrl, setSharedUrl] = useState('')
  const location = useLocation()
  const tabBarRef = useRef(null)
  const pillRef = useRef(null)
  const pillShownRef = useRef(false)

  // Sliding selected-tab pill: one peach pill measures the active tab and glides to it
  // instead of the highlight just jumping. It snaps (no glide) the first time it
  // appears, after being hidden, and on resize — gliding in from a stale spot looks
  // like a glitch. Hidden on screens that aren't a tab (a recipe, the editor, Profile).
  useLayoutEffect(() => {
    const bar = tabBarRef.current
    const pill = pillRef.current
    if (!bar || !pill) { pillShownRef.current = false; return }
    const place = (glide) => {
      const active = bar.querySelector('a[aria-current="page"]')
      if (!active) { pill.style.opacity = '0'; pillShownRef.current = false; return }
      if (!glide) pill.style.transition = 'none'
      pill.style.width = `${active.offsetWidth}px`
      pill.style.height = `${active.offsetHeight}px`
      pill.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`
      pill.style.opacity = '1'
      if (!glide) { pill.getBoundingClientRect(); pill.style.transition = '' }
      pillShownRef.current = true
    }
    place(pillShownRef.current)
    const onResize = () => place(false)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [location.pathname, cookMode])

  // Opened via a shared link, e.g. /recipes?import=<url> (iOS Shortcut / Android
  // share target). Open the importer prefilled, then strip the param.
  useEffect(() => {
    const shared = searchParams.get('import')
    if (!shared) return
    if (!canWrite) toast('Log in to import a recipe')
    setSharedUrl(shared)
    setShowImport(true)
    searchParams.delete('import')
    setSearchParams(searchParams, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function guardWrite() {
    if (!canWrite) { toast('Log in to add recipes'); return false }
    return true
  }
  function createFromScratch() {
    setShowAddMenu(false)
    if (guardWrite()) navigate('/new')
  }
  function openImport() {
    setShowAddMenu(false)
    if (guardWrite()) { setSharedUrl(''); setShowImport(true) }
  }

  const navItem = (isActive) =>
    `relative z-10 flex w-14 flex-col items-center gap-0.5 rounded-full py-1.5 text-[10px] font-bold transition-colors duration-300 ${
      isActive ? 'text-warm' : 'text-warm-soft/70'
    }`

  return (
    <div className="min-h-screen sm:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-warm/10 bg-white/60 px-4 py-6 backdrop-blur sm:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <PantryIcon className="h-7 w-7 text-zinc-800" />
          <span className="font-display text-xl font-bold">Pantry</span>
        </div>
        <button onClick={createFromScratch} className="btn-peach mb-2 w-full">
          <PlusIcon className="h-5 w-5" /> New Recipe
        </button>
        <button onClick={openImport} className="btn-ghost mb-4 w-full">
          <LinkIcon className="h-5 w-5 text-zinc-800" /> Import
        </button>
        <nav className="flex flex-col gap-1">
          {[...TABS, { to: '/profile', label: 'Profile', Icon: ProfileIcon }].map((t) => (
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

      <ScrollMemory />

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <OfflineBanner />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-[calc(env(safe-area-inset-bottom)+7rem)] sm:px-8 sm:pt-5 sm:pb-10">
          <Outlet />
        </main>
      </div>

      {/* Mobile add menu (popover above the center +) */}
      {showAddMenu && !cookMode && (
        <div className="fixed inset-0 z-40 sm:hidden" onClick={() => setShowAddMenu(false)}>
          {/* Centred with inset-x-0 + mx-auto rather than left-1/2 with a
              -translate-x-1/2. The fadein keyframes animate `transform`, and an
              animation's transform replaces the element's own — so a centring
              translate would be dropped for the duration of the animation,
              making the menu appear off to the right and then snap into place. */}
          <div
            className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+6rem)] mx-auto w-56 animate-fadein space-y-1 rounded-2xl bg-white p-2 shadow-card-hover"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="flex w-full items-center gap-2 rounded-xl px-4 py-3 text-left font-bold hover:bg-eggshell" onClick={openImport}>
              <LinkIcon className="h-5 w-5 text-zinc-800" /> Import a recipe
            </button>
            <button className="flex w-full items-center gap-2 rounded-xl px-4 py-3 text-left font-bold hover:bg-eggshell" onClick={createFromScratch}>
              <EditIcon className="h-5 w-5 text-zinc-800" /> Create from scratch
            </button>
          </div>
        </div>
      )}

      {/* Mobile floating "bubble" tab bar — hidden in Cook Mode, whose own
          Prev/Next bar is the only bottom control until you exit. */}
      {!cookMode && (
      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] sm:hidden">
        <div ref={tabBarRef} className="relative flex items-center gap-1 rounded-full border border-warm/10 bg-white/95 px-2 py-1.5 shadow-card-hover backdrop-blur">
          <div
            ref={pillRef}
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 rounded-full border border-peach-dark/40 bg-peach opacity-0 shadow-[inset_0_1px_3px_rgba(44,36,22,0.12)] transition-[transform,width,height,opacity] duration-[380ms] ease-[cubic-bezier(.3,.8,.25,1)]"
          />
          {TABS.slice(0, 2).map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => navItem(isActive)}>
              {({ isActive }) => (
                <>
                  <t.Icon className={`h-6 w-6 text-zinc-800 transition ${isActive ? 'scale-110' : 'opacity-50'}`} />
                  {t.label}
                </>
              )}
            </NavLink>
          ))}

          {/* Raised center add button */}
          <button
            onClick={() => setShowAddMenu((s) => !s)}
            aria-label="Add a recipe"
            className={`relative z-20 -mt-8 flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-cta text-white shadow-card-hover ring-4 ring-eggshell transition active:scale-90 hover:bg-cta-dark ${showAddMenu ? 'rotate-45' : ''}`}
          >
            <PlusIcon className="h-8 w-8" />
          </button>

          {TABS.slice(2).map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => navItem(isActive)}>
              {({ isActive }) => (
                <>
                  <t.Icon className={`h-6 w-6 text-zinc-800 transition ${isActive ? 'scale-110' : 'opacity-50'}`} />
                  {t.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
      )}

      {showImport && (
        <ImportModal initialUrl={sharedUrl} onClose={() => { setShowImport(false); setSharedUrl('') }} />
      )}
    </div>
  )
}
