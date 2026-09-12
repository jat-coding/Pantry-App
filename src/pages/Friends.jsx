import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useData } from '../contexts/DataContext.jsx'
import { useToast } from '../components/Toast.jsx'
import RecipeCard from '../components/RecipeCard.jsx'
import { FriendsIcon, ProfileIcon } from '../components/icons.jsx'
import { useScrollLock } from '../lib/useScrollLock.js'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
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
  const [viewing, setViewing] = useState(null) // friend being viewed

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
                <span className="text-sm font-bold text-warm-soft">Friends ✓</span>
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
                <button className="btn-ghost py-2 text-sm" onClick={() => setViewing(f)}>View Pantry</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {viewing && (
        <FriendProfile friend={viewing} onClose={() => setViewing(null)} onPocket={handleCopyToPantry}
          onRemove={async () => { await fs.removeFriend(user.uid, viewing.id); setViewing(null); toast('Friend removed') }} />
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

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto overscroll-contain bg-eggshell">
      <div className="mx-auto max-w-3xl px-4 py-5">
        <div className="mb-4 flex items-center justify-between">
          <button onClick={onClose} className="font-bold text-warm-soft">← Back</button>
          <button onClick={() => setConfirmingRemove(true)}
            className="text-sm font-bold text-red-600">Remove Friend</button>
        </div>
        <div className="mb-6 flex items-center gap-4">
          <Avatar user={friend} big />
          <div>
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

      {/* Floating back button — follows the scroll, so leaving doesn't mean
          scrolling all the way back up to reach the one at the top. */}
      <button
        onClick={onClose}
        aria-label="Back"
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] left-1/2 z-[71] flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full bg-white/95 text-lg shadow-card-hover backdrop-blur active:scale-90"
      >←</button>

      {confirmingRemove && (
        <ConfirmDialog
          message="Remove this friend?"
          confirmLabel="Remove"
          danger
          onConfirm={() => { setConfirmingRemove(false); onRemove() }}
          onCancel={() => setConfirmingRemove(false)}
        />
      )}
    </div>
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
