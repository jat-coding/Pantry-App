import { useEffect, useRef, useState } from 'react'
import { Check, ChevronLeft, Menu } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useData } from '../contexts/DataContext.jsx'
import { useToast } from '../components/Toast.jsx'
import RecipeCard from '../components/RecipeCard.jsx'
import { ListSkeleton, GridSkeleton } from '../components/Skeleton.jsx'
import { FriendsIcon, ProfileIcon } from '../components/icons.jsx'
import { useScrollLock } from '../lib/useScrollLock.js'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { useGoBack } from '../lib/useGoBack.js'
import * as fs from '../lib/firestore.js'

export default function Friends() {
  const { user, profile, guest } = useAuth()
  const { pocketRecipe, togglePantry, friends, friendsLoaded } = useData()
  const toast = useToast()
  const navigate = useNavigate()

  const [term, setTerm] = useState('')
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [requests, setRequests] = useState([])
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

  const viewing = viewingId ? friends.find((f) => f.id === viewingId) : null
  const openFriend = (f) => setSearchParams({ friend: f.id })
  const closeFriend = () => goBack('/friends')

  if (guest || !user) {
    return <Gate />
  }

  async function doSearch() {
    if (!term.trim()) return
    setSearching(true)
    try {
      const list = await fs.searchUsers(term.trim(), user.uid)
      setResults(list)
    } finally {
      setSearching(false)
    }
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
  const [inviteToken, setInviteToken] = useState(null)
  useEffect(() => {
    let alive = true
    fs.getOrCreateInviteToken(user.uid).then((t) => { if (alive) setInviteToken(t) }).catch(() => {})
    return () => { alive = false }
  }, [user.uid])
  // The token is the secret that makes the link add you as friends automatically.
  const inviteLink = `${window.location.origin}/invite/${user.uid}${inviteToken ? `?t=${inviteToken}` : ''}`

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

      {/* Search */}
      <div className="flex gap-2">
        <input className="input" placeholder="Search by display name…" value={term}
          onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doSearch()} />
        <button className="btn-peach px-5" onClick={doSearch}>Search</button>
      </div>
      {/* Invite link (compact) */}
      <div className="-mt-3 flex items-center gap-2">
        <span className="flex-1 text-sm font-bold text-warm-soft">Invite a friend</span>
        <button className="btn-peach px-3 py-1.5 text-sm" onClick={shareInvite}>Share</button>
        <button className="btn-ghost px-3 py-1.5 text-sm" onClick={copyInvite}>Copy link</button>
      </div>
      {searching ? (
        <ListSkeleton count={3} />
      ) : results && (
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
        {friends.length === 0 && !friendsLoaded ? (
          <ListSkeleton count={2} action={false} />
        ) : friends.length === 0 ? (
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
          me={user} myFriendIds={friendIds} incoming={requests} onRespond={respond}
          onRemove={async () => { await fs.removeFriend(user.uid, viewing.id); closeFriend(); toast('Friend removed') }} />
      )}
    </div>
  )
}

function FriendProfile({ friend, onClose, onPocket, onRemove, me, myFriendIds, incoming, onRespond }) {
  // Prefetched by DataContext while the phone was idle, so this is usually already
  // filled in on the first frame; the fetch below still runs and replaces it.
  const [recipes, setRecipes] = useState(() => fs.peekFriendRecipes(friend.id))
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  // Remove and their friends list both sit behind the header menu; the page opens on
  // just the recipes.
  const [menuOpen, setMenuOpen] = useState(false)
  const [showFriends, setShowFriends] = useState(false)
  const friendsRef = useRef(null)
  useEffect(() => {
    setRecipes(fs.peekFriendRecipes(friend.id))
    let alive = true
    fs.getFriendRecipes(friend.id)
      .then((list) => { if (alive) setRecipes(list) })
      .catch(() => { if (alive) setRecipes((r) => r ?? []) })
    return () => { alive = false }
  }, [friend.id])
  // Keep the page behind still; scrolling here shouldn't move it.
  useScrollLock()
  // The section sits below every recipe, so bring it into view once it's revealed.
  useEffect(() => {
    if (showFriends) friendsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [showFriends])

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
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="More options"
            aria-expanded={menuOpen}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-warm shadow-card transition active:scale-90"
          >
            <Menu className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Same popover as the mobile add menu in Layout: tap outside to close. The inner
          row mirrors the header's width and padding so the menu lines up under the icon
          on a wide screen too, not at the window's edge. */}
      {menuOpen && (
        <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)}>
          <div className="mx-auto flex max-w-3xl justify-end pt-[calc(env(safe-area-inset-top)+4.25rem)] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
            <div
              role="menu"
              className="w-56 animate-fadein space-y-1 rounded-2xl bg-white p-2 shadow-card-hover"
              onClick={(e) => e.stopPropagation()}
            >
              <button role="menuitem" className="flex w-full items-center rounded-xl px-4 py-3 text-left font-bold hover:bg-eggshell"
                onClick={() => { setMenuOpen(false); setShowFriends(true); friendsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>
                See their friends
              </button>
              <button role="menuitem" className="flex w-full items-center rounded-xl px-4 py-3 text-left font-bold text-red-600 hover:bg-eggshell"
                onClick={() => { setMenuOpen(false); setConfirmingRemove(true) }}>
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

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
          <GridSkeleton count={3} />
        ) : recipes.length === 0 ? (
          <p className="text-warm-soft">No recipes to show yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recipes.map((r) => (
              <RecipeCard key={r.id} recipe={r} showPocket pocketLabel="Copy to Pantry" onPocket={onPocket} />
            ))}
          </div>
        )}

        {showFriends && (
          // Room for a full screen below the heading: the list loads after the scroll
          // starts, and at the very end of the page the heading would otherwise stop
          // near the bottom of the screen instead of under the header.
          <div ref={friendsRef} className="min-h-[calc(100dvh-6rem)] scroll-mt-24">
            <FriendsOfFriend friend={friend} me={me} myFriendIds={myFriendIds} incoming={incoming} onRespond={onRespond} />
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

// The viewed friend's own friends, each with an Add button unless you're already
// friends or a request is already waiting either way.
function FriendsOfFriend({ friend, me, myFriendIds, incoming, onRespond }) {
  const toast = useToast()
  const [people, setPeople] = useState(null)
  const [outgoing, setOutgoing] = useState([])
  const [sent, setSent] = useState(() => new Set())
  const [accepted, setAccepted] = useState(() => new Set())
  const idsKey = (friend.friendIds || []).join(',')
  useEffect(() => {
    let alive = true
    setPeople(null)
    // You are always on a friend's list here (friendships are mutual), so skip yourself.
    const ids = (friend.friendIds || []).filter((id) => id !== me.uid)
    fs.getUsersByIds(ids)
      // Mutual only, same as your own list: a one-sided leftover entry isn't a friend.
      .then((list) => { if (alive) setPeople(list.filter((u) => (u.friendIds || []).includes(friend.id))) })
      .catch(() => { if (alive) setPeople([]) })
    return () => { alive = false }
  }, [friend.id, idsKey, me.uid])
  useEffect(() => fs.listenOutgoingRequests(me.uid, setOutgoing), [me.uid])

  const waitingOnThem = new Set([...outgoing, ...sent])
  const askedMe = new Map(incoming.map((r) => [r.fromUserId, r]))

  async function add(u) {
    if (waitingOnThem.has(u.id)) return
    setSent((s) => new Set(s).add(u.id))
    try {
      await fs.sendFriendRequest(me, u.id)
      toast('Friend request sent')
    } catch {
      setSent((s) => { const n = new Set(s); n.delete(u.id); return n })
      toast('Could not send request')
    }
  }

  async function accept(req) {
    // Shown as friends straight away: the request leaves the pending list before your
    // own friend list catches up, which would otherwise flash an Add button.
    setAccepted((s) => new Set(s).add(req.fromUserId))
    await onRespond(req, true)
  }

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-extrabold">{friend.displayName}'s Friends</h2>
      {people == null ? (
        <ListSkeleton count={2} />
      ) : people.length === 0 ? (
        <p className="text-warm-soft">No other friends yet.</p>
      ) : (
        <div className="space-y-2">
          {people.map((u) => (
            <div key={u.id} data-fof={u.id} className="card flex items-center gap-3 p-3">
              <Avatar user={u} />
              <span className="min-w-0 flex-1 truncate font-bold">{u.displayName}</span>
              {myFriendIds.has(u.id) || accepted.has(u.id) ? (
                <span className="inline-flex items-center gap-1 text-sm font-bold text-warm-soft">Friends <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" /></span>
              ) : askedMe.has(u.id) ? (
                <button className="btn-peach py-2 text-sm" onClick={() => accept(askedMe.get(u.id))}>Accept</button>
              ) : waitingOnThem.has(u.id) ? (
                <span className="text-sm font-bold text-warm-soft">Requested</span>
              ) : (
                <button className="btn-ghost py-2 text-sm" onClick={() => add(u)}>Add</button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
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
