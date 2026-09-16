import { useEffect, useState } from 'react'
import { Check, ChevronLeft } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useData } from '../contexts/DataContext.jsx'
import { useToast } from '../components/Toast.jsx'
import RecipeCard from '../components/RecipeCard.jsx'
import { FriendsIcon, ProfileIcon } from '../components/icons.jsx'
import { useScrollLock } from '../lib/useScrollLock.js'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { useGoBack } from '../lib/useGoBack.js'
import * as fs from '../lib/firestore.js'

export default function Friends() {
  const { user, profile, guest } = useAuth()
  const { pocketRecipe, togglePantry } = useData()
  const toast = useToast()
  const navigate = useNavigate()

  const [term, setTerm] = useState('')
  const [results, setResults] = useState(null)
  const [requests, setRequests] = useState([])
  const [friends, setFriends] = useState([])
  const goBack = useGoBack()
  // The open friend pantry lives in the URL (?friend=<id>), not component state, so it's
  // a real history step: opening a recipe from a friend's pantry and tapping back lands
  // you in that pantry again, instead of on the bare Friends list with it closed.
  const [searchParams, setSearchParams] = useSearchParams()
  const viewingId = searchParams.get('friend')

  // Live incoming friend requests.
  useEffect(() => {
    if (!user) return
    return fs.listenIncomingRequests(user.uid, setRequests)
  }, [user])

  // Resolve friend profiles from ids.
  useEffect(() => {
    if (!profile?.friendIds?.length) { setFriends([]); return }
    fs.getUsersByIds(profile.friendIds).then(setFriends)
  }, [profile?.friendIds])

  const viewing = viewingId ? friends.find((f) => f.id === viewingId) : null
  const openFriend = (f) => setSearchParams({ friend: f.id })
  const closeFriend = () => goBack('/friends')

  if (guest || !user) {
    return <Gate />
  }

  async function doSearch() {
    if (!term.trim()) return
    const list = await fs.searchUsers(term.trim(), user.uid)
    setResults(list)
  }

  async function addFriend(u) {
    await fs.sendFriendRequest(user, u.id)
    toast('Friend request sent')
  }

  async function respond(req, accept) {
    await fs.respondToRequest(req, accept, user.uid)
    toast(accept ? `You and ${req.fromDisplayName} are now friends` : 'Request declined')
  }

  async function handleCopyToPantry(recipe) {
    try {
      const newId = await pocketRecipe(recipe)
      await togglePantry(newId)
      toast('Copied to your Pantry')
    } catch {
      toast('Could not copy recipe')
    }
  }

  const friendIds = new Set(profile?.friendIds || [])
  const inviteLink = `${window.location.origin}/invite/${user.uid}`

  function copyInvite() {
    navigator.clipboard?.writeText(inviteLink)
      .then(() => toast('Invite link copied!'))
      .catch(() => toast('Could not copy — long-press the link to copy'))
  }

  async function shareInvite() {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Add me on Pantry', text: 'Be my friend on Pantry', url: inviteLink })
      } catch {
        // user cancelled the share sheet — ignore
      }
    } else {
      copyInvite()
    }
  }

  return (
    <div className="animate-fadein space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Friends</h1>
          <p className="text-warm-soft">Find friends and pocket their recipes.</p>
        </div>
        <button
          onClick={() => navigate('/profile')}
          aria-label="Your profile"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-zinc-800 shadow-card transition active:scale-90 hover:bg-eggshell"
        >
          {profile?.avatarUrl
            ? <img src={profile.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
            : <ProfileIcon className="h-6 w-6" />}
        </button>
      </header>

      {/* Invite link */}
      <div className="card p-5">
        <h2 className="text-lg font-extrabold">Invite a friend</h2>
        <p className="mb-3 text-sm text-warm-soft">
          Share this link. When your friend opens it while logged in, you'll be added to each other's friends.
        </p>
        <input
          className="input mb-2 text-sm"
          value={inviteLink}
          readOnly
          onFocus={(e) => e.target.select()}
        />
        <div className="flex gap-2">
          <button className="btn-peach flex-1" onClick={shareInvite}>Share</button>
          <button className="btn-ghost flex-1" onClick={copyInvite}>Copy link</button>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <input className="input" placeholder="Search by display name…" value={term}
          onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doSearch()} />
        <button className="btn-peach px-5" onClick={doSearch}>Search</button>
      </div>
      {results && (
        <div className="space-y-2">
          {results.length === 0 && <p className="text-sm text-warm-soft">No users found.</p>}
          {results.map((u) => (
            <div key={u.id} className="card flex items-center gap-3 p-3">
              <Avatar user={u} />
              <span className="flex-1 font-bold">{u.displayName}</span>
              {friendIds.has(u.id) ? (
                <span className="inline-flex items-center gap-1 text-sm font-bold text-warm-soft">Friends <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" /></span>
              ) : (
                <button className="btn-ghost py-2 text-sm" onClick={() => addFriend(u)}>Add</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Incoming requests */}
      {requests.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-extrabold">Requests</h2>
          <div className="space-y-2">
            {requests.map((r) => (
              <div key={r.id} className="card flex items-center gap-3 p-3">
                <span className="flex-1 font-bold">{r.fromDisplayName}</span>
                <button className="btn-peach py-2 text-sm" onClick={() => respond(r, true)}>Accept</button>
                <button className="btn-ghost py-2 text-sm" onClick={() => respond(r, false)}>Decline</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Friends list */}
      <section>
        <h2 className="mb-2 text-lg font-extrabold">My Friends</h2>
        {friends.length === 0 ? (
          <p className="text-sm text-warm-soft">No friends yet — search above to connect.</p>
        ) : (
          <div className="space-y-2">
            {friends.map((f) => (
              <div key={f.id} className="card flex items-center gap-3 p-3">
                <Avatar user={f} />
                <span className="flex-1 font-bold">{f.displayName}</span>
                <button className="btn-ghost py-2 text-sm" onClick={() => openFriend(f)}>View Pantry</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {viewing && (
        <FriendProfile friend={viewing} onClose={closeFriend} onPocket={handleCopyToPantry}
          onRemove={async () => { await fs.removeFriend(user.uid, viewing.id); closeFriend(); toast('Friend removed') }} />
      )}
    </div>
  )
}

function FriendProfile({ friend, onClose, onPocket, onRemove }) {
  const [recipes, setRecipes] = useState(null)
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  useEffect(() => { fs.getFriendRecipes(friend.id).then(setRecipes).catch(() => setRecipes([])) }, [friend.id])
  // Keep the page behind still; scrolling here shouldn't move it.
  useScrollLock()

  // Portaled to <body>: a `position: fixed` overlay nested inside the page inherits
  // any transform/filter an ancestor has (the page's fade-in animation is one), which
  // makes "fixed" behave like "absolute" on some phones and clips the overlay.
  return createPortal(
    // Every edge respects the phone's safe areas (notch/Dynamic Island on top, home
    // indicator on the bottom, rounded corners on the sides in landscape) — without
    // these, content slides under the status bar and past the bottom of the screen.
    <div className="fixed inset-0 z-[70] overflow-y-auto overscroll-contain bg-eggshell">
      {/* Sticky header: the back button stays reachable at the top-left however far
          you've scrolled, so no separate floating button is needed. */}
      <header className="sticky top-0 z-10 border-b border-warm/10 bg-eggshell/95 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
          <button
            onClick={onClose}
            aria-label="Back"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-warm shadow-card transition active:scale-90"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
          </button>
          <span className="min-w-0 flex-1 truncate text-center font-extrabold">{friend.displayName}</span>
          <button onClick={() => setConfirmingRemove(true)}
            className="shrink-0 rounded-full px-3 py-2 text-sm font-bold text-red-600 transition active:scale-95">Remove</button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl pt-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <div className="mb-6 flex items-center gap-4">
          <Avatar user={friend} big />
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold">{friend.displayName}</h1>
            {friend.bio && <p className="text-warm-soft">{friend.bio}</p>}
          </div>
        </div>
        <h2 className="mb-3 text-lg font-extrabold">{friend.displayName}'s Pantry</h2>
        {recipes == null ? (
          <p className="text-warm-soft">Loading…</p>
        ) : recipes.length === 0 ? (
          <p className="text-warm-soft">No recipes to show yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recipes.map((r) => (
              <RecipeCard key={r.id} recipe={r} showPocket pocketLabel="Copy to Pantry" onPocket={onPocket} />
            ))}
          </div>
        )}
      </div>

      {confirmingRemove && (
        <ConfirmDialog
          message="Remove this friend?"
          confirmLabel="Remove"
          danger
          onConfirm={() => { setConfirmingRemove(false); onRemove() }}
          onCancel={() => setConfirmingRemove(false)}
        />
      )}
    </div>,
    document.body,
  )
}

function Avatar({ user, big }) {
  const size = big ? 'h-16 w-16 text-2xl' : 'h-10 w-10'
  return user.avatarUrl ? (
    <img src={user.avatarUrl} alt="" className={`${size} rounded-full object-cover`} />
  ) : (
    <span className={`${size} flex items-center justify-center rounded-full bg-peach font-extrabold text-warm`}>
      {(user.displayName || '?')[0].toUpperCase()}
    </span>
  )
}

function Gate() {
  const { logout } = useAuth()
  return (
    <div className="card mt-10 px-6 py-16 text-center">
      <div className="mb-2 flex justify-center text-zinc-800"><FriendsIcon className="h-12 w-12" /></div>
      <p className="font-bold">Friends are for members</p>
      <p className="mb-4 text-sm text-warm-soft">Log in to find friends and pocket their recipes.</p>
      <button className="btn-peach" onClick={logout}>Go to login</button>
    </div>
  )
}
