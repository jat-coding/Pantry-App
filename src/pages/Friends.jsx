import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useData } from '../contexts/DataContext.jsx'
import { useToast } from '../components/Toast.jsx'
import RecipeCard from '../components/RecipeCard.jsx'
import { AddToPantryPrompt } from './RecipeEditor.jsx'
import * as fs from '../lib/firestore.js'

export default function Friends() {
  const { user, profile, guest } = useAuth()
  const { pocketRecipe, togglePantry } = useData()
  const toast = useToast()

  const [term, setTerm] = useState('')
  const [results, setResults] = useState(null)
  const [requests, setRequests] = useState([])
  const [friends, setFriends] = useState([])
  const [viewing, setViewing] = useState(null) // friend being viewed
  const [pocketPrompt, setPocketPrompt] = useState(null) // newly pocketed recipe id

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

  async function handlePocket(recipe) {
    const newId = await pocketRecipe(recipe)
    toast('Recipe pocketed!')
    setPocketPrompt(newId)
  }

  const friendIds = new Set(profile?.friendIds || [])

  return (
    <div className="animate-fadein space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold">Friends 👥</h1>
        <p className="text-warm-soft">Find friends and pocket their recipes.</p>
      </header>

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
        <FriendProfile friend={viewing} onClose={() => setViewing(null)} onPocket={handlePocket}
          onRemove={async () => { await fs.removeFriend(user.uid, viewing.id); setViewing(null); toast('Friend removed') }} />
      )}

      {pocketPrompt && (
        <AddToPantryPrompt
          onYes={async () => { await togglePantry(pocketPrompt); toast('Added to Pantry 🫙'); setPocketPrompt(null) }}
          onNo={() => setPocketPrompt(null)}
        />
      )}
    </div>
  )
}

function FriendProfile({ friend, onClose, onPocket, onRemove }) {
  const [recipes, setRecipes] = useState(null)
  useEffect(() => { fs.getPublicRecipesOf(friend.id).then(setRecipes) }, [friend.id])

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-eggshell">
      <div className="mx-auto max-w-3xl px-4 py-5">
        <div className="mb-4 flex items-center justify-between">
          <button onClick={onClose} className="font-bold text-warm-soft">← Back</button>
          <button onClick={() => window.confirm('Remove this friend?') && onRemove()}
            className="text-sm font-bold text-red-600">Remove Friend</button>
        </div>
        <div className="mb-6 flex items-center gap-4">
          <Avatar user={friend} big />
          <div>
            <h1 className="text-2xl font-extrabold">{friend.displayName}</h1>
            {friend.bio && <p className="text-warm-soft">{friend.bio}</p>}
          </div>
        </div>
        <h2 className="mb-3 text-lg font-extrabold">Public Recipes</h2>
        {recipes == null ? (
          <p className="text-warm-soft">Loading…</p>
        ) : recipes.length === 0 ? (
          <p className="text-warm-soft">No public recipes yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recipes.map((r) => (
              <RecipeCard key={r.id} recipe={r} showPocket onPocket={onPocket} />
            ))}
          </div>
        )}
      </div>
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
  return (
    <div className="card mt-10 px-6 py-16 text-center">
      <div className="mb-2 text-5xl">👥</div>
      <p className="font-bold">Friends are for members</p>
      <p className="text-sm text-warm-soft">Log in to find friends and pocket their recipes.</p>
    </div>
  )
}
