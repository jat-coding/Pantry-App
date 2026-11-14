import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronLeft, Link2, Menu, RefreshCw, Share, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useData } from '../contexts/DataContext.jsx'
import { useToast } from '../components/Toast.jsx'
import RecipeCard from '../components/RecipeCard.jsx'
import { ListSkeleton, GridSkeleton } from '../components/Skeleton.jsx'
import { FriendsIcon, ProfileIcon, CategoryIcon, PlusIcon, HeartIcon, TrashIcon } from '../components/icons.jsx'
import { ViewToggle, FavoritesToggle, RecipeListView, VIEW_KEY } from '../components/RecipeViews.jsx'
import { CATEGORIES, primaryCategory } from '../lib/categories.js'
import { useScrollLock } from '../lib/useScrollLock.js'
import { useStandaloneBottomGap } from '../lib/useStandaloneBottomGap.js'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { useGoBack } from '../lib/useGoBack.js'
import * as fs from '../lib/firestore.js'
import SafeImage from '../components/SafeImage.jsx'
import { findLikelyDuplicate, formatPostDate, hasLiked, likeCount, likersList, toggleLikeLocal } from '../lib/socialFeed.js'
import PostComposer from '../components/PostComposer.jsx'
import { tap } from '../lib/haptics.js'

// Recipes whose stored category isn't one of CATEGORIES (very old data) still
// need a home, so they land in this section after the real ones. Matches Pantry.jsx.
const OTHER = 'Other'
// How many recipes a category shows before its "See all" button. Matches Pantry.jsx.
const PREVIEW_COUNT = 4

export default function Friends() {
  const { user, profile, guest } = useAuth()
  const { pocketRecipe, togglePantry, friends, friendsLoaded, recipes: myRecipes } = useData()
  const toast = useToast()
  const navigate = useNavigate()

  const [term, setTerm] = useState('')
  // My Friends is collapsible so the Feed leads the page. Collapsed by default; the
  // choice is remembered on this device. No stored choice and no friends yet: open, so a
  // new user still sees the search box.
  const [friendsOpenPref, setFriendsOpenPref] = useState(() => {
    const v = localStorage.getItem(FRIENDS_OPEN_KEY)
    return v === null ? null : v === '1'
  })
  // A search in progress always keeps it open; collapsing clears the search.
  const friendsOpen = term.trim() !== '' || (friendsOpenPref ?? (friendsLoaded && friends.length === 0))
  const setFriendsOpen = (open) => {
    if (!open) setTerm('')
    setFriendsOpenPref(open)
    localStorage.setItem(FRIENDS_OPEN_KEY, open ? '1' : '0')
  }
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [requests, setRequests] = useState([])
  // People I've asked (live) plus ones asked this visit, so a search result never offers
  // Add twice; `busy` holds the ids whose own tap is still in flight.
  const [outgoing, setOutgoing] = useState([])
  const [sent, setSent] = useState(() => new Set())
  const [busy, setBusy] = useState(() => new Set())
  // A feed post's recipe waiting on "Save anyway" because it looks like one of mine.
  const [dupPrompt, setDupPrompt] = useState(null)
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
  useEffect(() => {
    if (!user) return
    return fs.listenOutgoingRequests(user.uid, setOutgoing)
  }, [user])

  // Search as you type: look up a short beat after the last keystroke, so a name typed
  // fast is one read, not one per letter. A lookup that comes back after the box has
  // changed again is dropped rather than overwriting the newer results.
  useEffect(() => {
    const t = term.trim()
    if (!user || !t) {
      setResults(null)
      setSearching(false)
      return
    }
    let alive = true
    setSearching(true)
    const timer = setTimeout(() => {
      fs.searchUsers(t, user.uid)
        .then((list) => { if (alive) setResults(list) })
        .catch(() => { if (alive) setResults([]) })
        .finally(() => { if (alive) setSearching(false) })
    }, 300)
    return () => { alive = false; clearTimeout(timer) }
  }, [term, user])

  const viewing = viewingId ? friends.find((f) => f.id === viewingId) : null
  const openFriend = (f) => setSearchParams({ friend: f.id })
  const closeFriend = () => goBack('/friends')

  if (guest || !user) {
    return <Gate />
  }

  const markBusy = (id, on) => setBusy((b) => { const n = new Set(b); if (on) n.add(id); else n.delete(id); return n })

  async function addFriend(u) {
    if (busy.has(u.id)) return
    markBusy(u.id, true)
    try {
      const result = await fs.sendFriendRequest(user, u.id)
      setSent((s) => new Set(s).add(u.id))
      toast(result === 'friends' ? `You and ${u.displayName} are now friends`
        : result === 'pending' ? 'Already requested' : 'Friend request sent')
    } catch {
      toast('Could not send request')
    } finally {
      markBusy(u.id, false)
    }
  }

  async function respond(req, accept) {
    if (busy.has(req.fromUserId)) return
    markBusy(req.fromUserId, true)
    try {
      await fs.respondToRequest(req, accept, user.uid)
      toast(accept ? `You and ${req.fromDisplayName} are now friends` : 'Request declined')
    } finally {
      markBusy(req.fromUserId, false)
    }
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

  // Copying from the Social feed copies the RECIPE the post links to (fetched fresh:
  // full ingredients/instructions and the recipe's own photo), never the post's photo.
  // Check my library for a likely duplicate first, and only copy on an explicit
  // "Save anyway". The recipe's own photo isn't deleted by post expiry, so the copy
  // keeps its link to it, same as copying from a friend's pantry.
  async function handleFeedCopy(post) {
    let recipe = null
    try {
      recipe = await fs.getRecipe(post.recipeId)
    } catch {
      // handled below
    }
    if (!recipe) return toast('That recipe is no longer available')
    const dup = findLikelyDuplicate(recipe, myRecipes)
    if (dup) setDupPrompt({ recipe, existing: dup.recipe })
    else return handleCopyToPantry(recipe)
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
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Social</h1>
        </div>
        <button
          onClick={() => navigate('/profile')}
          aria-label="Your profile"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-zinc-800 shadow-card transition active:scale-90 hover:bg-eggshell"
        >
          <SafeImage src={profile?.avatarUrl} alt="" className="h-full w-full rounded-full object-cover"
            fallback={<ProfileIcon className="h-6 w-6" />} />
        </button>
      </header>

      {/* Incoming requests */}
      {requests.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-extrabold">Requests</h2>
          <div className="space-y-2">
            {requests.map((r) => (
              <div key={r.id} className="card flex items-center gap-3 p-3">
                <span className="flex-1 font-bold">{r.fromDisplayName}</span>
                <button className="btn-peach py-2 text-sm" disabled={busy.has(r.fromUserId)} onClick={() => respond(r, true)}>Accept</button>
                <button className="btn-ghost py-2 text-sm" disabled={busy.has(r.fromUserId)} onClick={() => respond(r, false)}>Decline</button>
              </div>
            ))}
          </div>
        </section>
      )}

      <SocialFeed me={user} myProfile={profile} friends={friends} friendsLoaded={friendsLoaded} onCopy={handleFeedCopy} myRecipes={myRecipes} />

      {/* Friends list: collapsible. The title row toggles it; the plus sits outside the
          toggle so inviting never opens or closes the section. Search lives inside. */}
      <section>
        <div className="flex items-center gap-2">
          <button onClick={() => setFriendsOpen(!friendsOpen)} aria-expanded={friendsOpen} aria-controls="my-friends-body"
            className="flex flex-1 items-center gap-1.5 py-1 text-left">
            <h2 className="text-lg font-extrabold">My Friends</h2>
            {friends.length > 0 && <span className="text-sm font-bold text-warm-soft">{friends.length}</span>}
            <ChevronDown className={`h-5 w-5 text-warm-soft transition-transform ${friendsOpen ? 'rotate-180' : ''}`} strokeWidth={2.4} aria-hidden="true" />
          </button>
          <InviteMenu onShare={shareInvite} onCopy={copyInvite} />
        </div>
        {friendsOpen && (
          <div id="my-friends-body" className="mt-2 space-y-3 animate-fadein">
            <input className="input" placeholder="Search by display name…" value={term}
              onChange={(e) => setTerm(e.target.value)} />
            {/* Skeleton only until the first results land; after that the last list stays up
                while the next lookup runs, so it doesn't blink on every pause in typing. */}
            {searching && !results ? (
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
                    ) : outgoing.includes(u.id) || sent.has(u.id) ? (
                      <span className="text-sm font-bold text-warm-soft">Requested</span>
                    ) : (
                      <button className="btn-ghost py-2 text-sm" disabled={busy.has(u.id)} onClick={() => addFriend(u)}>Add</button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {friends.length === 0 && !friendsLoaded ? (
              <ListSkeleton count={2} action={false} />
            ) : friends.length === 0 ? (
              <p className="text-sm text-warm-soft">No friends yet. Search by name to connect.</p>
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
          </div>
        )}
      </section>

      {dupPrompt && (
        <ConfirmDialog
          message={`This looks a lot like your "${dupPrompt.existing.title}". Save anyway?`}
          confirmLabel="Save anyway"
          onConfirm={() => { const r = dupPrompt.recipe; setDupPrompt(null); handleCopyToPantry(r) }}
          onCancel={() => setDupPrompt(null)}
        />
      )}

      {viewing && (
        <FriendProfile friend={viewing} onClose={closeFriend} onPocket={handleCopyToPantry}
          me={user} myFriendIds={friendIds} incoming={requests} onRespond={respond}
          onRemove={async () => { await fs.removeFriend(user.uid, viewing.id); closeFriend(); toast('Friend removed') }} />
      )}
    </div>
  )
}

const FRIENDS_OPEN_KEY = 'pantry-friends-open'

// Round plus at the right of the My Friends title (same look as the Feed row's refresh
// button). Opens a small menu with the two invite actions; closes on an outside tap,
// Escape, or after picking one.
function InviteMenu({ onShare, onCopy }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  const pick = (fn) => { setOpen(false); fn() }
  return (
    <div ref={wrapRef} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label="Invite a friend" aria-haspopup="menu" aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-zinc-800 shadow-card transition active:scale-90 hover:bg-eggshell">
        <PlusIcon className={`h-5 w-5 transition-transform ${open ? 'rotate-45' : ''}`} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-2 w-48 overflow-hidden rounded-2xl bg-white p-1.5 shadow-card ring-1 ring-black/5 animate-fadein">
          <p className="px-3 pb-1 pt-1.5 text-xs font-bold text-warm-soft">Invite a friend</p>
          <button role="menuitem" onClick={() => pick(onShare)}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-zinc-800 hover:bg-eggshell active:bg-eggshell">
            <Share className="h-4 w-4 text-cta" strokeWidth={2.2} aria-hidden="true" /> Share
          </button>
          <button role="menuitem" onClick={() => pick(onCopy)}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-zinc-800 hover:bg-eggshell active:bg-eggshell">
            <Link2 className="h-4 w-4 text-cta" strokeWidth={2.2} aria-hidden="true" /> Copy link
          </button>
        </div>
      )}
    </div>
  )
}

// Strava-style feed: my friends' posts and my own, newest first. Each post: who, when,
// the photo taken at post time, the linked recipe's title (opens the recipe), and Copy
// to Pantry on friends' posts. Post (top right) picks a photo, then PostComposer links
// a recipe to it; a new post lands at the top through the same refresh as the button.
function SocialFeed({ me, myProfile, friends, friendsLoaded, onCopy, myRecipes = [] }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [posts, setPosts] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  // The photo picked by Post; non-null = composer open.
  const [photo, setPhoto] = useState(null)
  const toast = useToast()
  // My post waiting on the delete confirm, and the post whose likes sheet is open (by id,
  // so the sheet follows a like/unlike made while it's open).
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [likesFor, setLikesFor] = useState(null)
  // Deleted this session: a refresh that started before the delete landed must not bring
  // the post back. Likes in flight per post, so a fast double tap can't race itself.
  const deletedRef = useRef(new Set())
  const likingRef = useRef(new Set())
  const idsKey = friends.map((f) => f.id).sort().join(',')
  useEffect(() => {
    if (!friendsLoaded) return
    let alive = true
    fs.getFeedPosts([me.uid, ...(idsKey ? idsKey.split(',') : [])])
      .then((list) => { if (alive) setPosts(list.filter((p) => !deletedRef.current.has(p.id))) })
      .catch(() => { if (alive) setPosts((prev) => prev ?? []) })
      .finally(() => { if (alive) setRefreshing(false) })
    return () => { alive = false }
  }, [idsKey, friendsLoaded, reloadKey, me.uid])
  const refresh = () => { if (refreshing) return; setRefreshing(true); setReloadKey((k) => k + 1) }
  const byId = new Map(friends.map((f) => [f.id, f]))
  byId.set(me.uid, { ...myProfile, displayName: myProfile?.displayName || me.displayName || 'Me' })
  const openRecipe = (id) => navigate(`/recipe/${id}`, { state: { from: location.pathname } })
  const myName = myProfile?.displayName || me.displayName || 'Someone'
  const patchPost = (id, fn) => setPosts((list) => list && list.map((p) => (p.id === id ? fn(p) : p)))

  async function toggleLike(post) {
    if (likingRef.current.has(post.id)) return
    likingRef.current.add(post.id)
    const liked = !hasLiked(post, me.uid)
    patchPost(post.id, (p) => toggleLikeLocal(p, me.uid, myName))
    try {
      await fs.setPostLike(post.id, me.uid, myName, liked)
    } catch {
      // Roll back just my key (other changes to the post since then stay).
      patchPost(post.id, (p) => (hasLiked(p, me.uid) === liked ? toggleLikeLocal(p, me.uid, myName) : p))
      toast(liked ? "Couldn't like that post" : "Couldn't remove your like")
    } finally {
      likingRef.current.delete(post.id)
    }
  }

  async function deletePost(post) {
    setConfirmDelete(null)
    deletedRef.current.add(post.id)
    setPosts((list) => list && list.filter((p) => p.id !== post.id))
    try {
      await fs.deletePost(post, me.uid, myRecipes)
      toast('Post deleted')
    } catch {
      deletedRef.current.delete(post.id)
      toast("Couldn't delete the post")
      refresh()
    }
  }

  const pickPhoto = (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setPhoto(f) }

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="flex-1 text-lg font-extrabold">Feed</h2>
        <button onClick={refresh} disabled={refreshing || !friendsLoaded} aria-label="Refresh feed"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-zinc-800 shadow-card transition active:scale-90 hover:bg-eggshell disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
        {/* Same filled orange circle-and-plus as the bottom bar's add button. No
            `capture` attribute, so the phone offers both Take Photo and the library. */}
        <label aria-label="New post"
          className="flex h-9 cursor-pointer items-center gap-1 rounded-full bg-cta pl-2.5 pr-3.5 text-sm font-bold text-white shadow-card transition active:scale-90 hover:bg-cta-dark">
          <PlusIcon className="h-5 w-5" /> Post
          <input type="file" accept="image/*" className="hidden" onChange={pickPhoto} />
        </label>
      </div>
      {posts == null ? (
        <ListSkeleton count={2} action={false} />
      ) : posts.length === 0 ? (
        <p className="text-sm text-warm-soft">No posts yet. Tap Post to share a photo of something you made.</p>
      ) : (
        <div className="space-y-4">
          {posts.map((p) => {
            const author = byId.get(p.authorId) || { displayName: p.authorName }
            const mine = p.authorId === me.uid
            return (
              <article key={p.id} data-post={p.id} className="card overflow-hidden">
                {/* Header: who posted, then the recipe it links (opens the recipe) and
                    when. Below the photo is only the poster's caption, if any. */}
                <div className="flex items-start gap-3 p-3">
                  <Avatar user={author} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-baseline gap-1.5">
                      <span className="truncate font-bold">{mine ? 'You' : author.displayName}</span>
                      <span className="shrink-0 text-xs text-warm-soft">{formatPostDate(p.postedAt)}</span>
                    </p>
                    <button onClick={() => openRecipe(p.recipeId)} data-post-recipe
                      className="line-clamp-2 text-left text-sm font-bold leading-snug text-cta-dark hover:underline">
                      {p.recipeTitle}
                    </button>
                  </div>
                  {mine ? (
                    <button onClick={() => setConfirmDelete(p)} aria-label="Delete post" data-post-delete
                      className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-warm-soft transition active:scale-90 hover:bg-eggshell hover:text-red-600">
                      <TrashIcon className="h-[18px] w-[18px]" />
                    </button>
                  ) : (
                    <button className="btn-peach shrink-0 px-3 py-1.5 text-sm" aria-label="Copy to Pantry" onClick={() => onCopy(p)}>Copy</button>
                  )}
                </div>
                {p.imageUrl && (
                  <button onClick={() => openRecipe(p.recipeId)} className="block w-full" aria-label={`Open ${p.recipeTitle}`}>
                    <SafeImage src={p.imageUrl} alt={p.recipeTitle} className="aspect-[4/3] w-full object-cover" fallback={null} />
                  </button>
                )}
                {/* Bottom row: caption (if any) on the left, heart + like count at the
                    bottom right. Heart = like/unlike; the count opens who liked it. */}
                <div className="flex items-end gap-2 py-1.5 pl-3 pr-1.5">
                  <div className="min-w-0 flex-1 py-1.5">
                    {p.caption?.trim() && (
                      <p data-post-caption className="whitespace-pre-line break-words text-[15px] leading-snug text-warm">
                        {p.caption.trim()}
                      </p>
                    )}
                  </div>
                  <LikeButton post={p} liked={hasLiked(p, me.uid)} onToggle={() => toggleLike(p)}
                    onShowLikes={() => setLikesFor(p.id)} />
                </div>
              </article>
            )
          })}
        </div>
      )}
      {confirmDelete && (
        <ConfirmDialog message="Delete this post? It disappears from everyone's feed. Your recipe stays."
          confirmLabel="Delete" danger onConfirm={() => deletePost(confirmDelete)} onCancel={() => setConfirmDelete(null)} />
      )}
      {likesFor && posts?.some((p) => p.id === likesFor) && (
        <LikesSheet likers={likersList(posts.find((p) => p.id === likesFor), byId, me.uid)} onClose={() => setLikesFor(null)} />
      )}
      {photo && (
        <PostComposer file={photo} onChangeFile={setPhoto} onClose={() => setPhoto(null)}
          onPosted={() => { setPhoto(null); refresh() }} />
      )}
    </section>
  )
}

function FriendProfile({ friend, onClose, onPocket, onRemove, me, myFriendIds, incoming, onRespond }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { pantryIds } = useData()
  // Prefetched by DataContext while the phone was idle, so this is usually already
  // filled in on the first frame; the fetch below still runs and replaces it.
  const [recipes, setRecipes] = useState(() => fs.peekFriendRecipes(friend.id))
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  // Remove and their friends list both sit behind the header menu; the page opens on
  // just the recipes.
  const [menuOpen, setMenuOpen] = useState(false)
  const [showFriends, setShowFriends] = useState(false)
  const friendsRef = useRef(null)
  // Shared with My Pantry: grid vs list is a personal viewing preference, not
  // per-screen, so it's the same key and reads whatever My Pantry last set.
  const [view, setView] = useState(() => localStorage.getItem(VIEW_KEY) || 'grid')
  const [expanded, setExpanded] = useState([])
  // 'all' or 'favorites': favorites = the recipes in the friend's OWN pantryIds (what
  // they hearted), not yours, so it reads as their curated list. pantryIds is already
  // on the friend's user doc that DataContext loaded, so no extra read.
  const [show, setShow] = useState('all')
  const bottomGap = useStandaloneBottomGap()
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

  function setViewPersist(v) {
    setView(v)
    localStorage.setItem(VIEW_KEY, v)
  }

  function toggleExpanded(c) {
    setExpanded((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]))
  }

  const visible = useMemo(() => {
    if (show !== 'favorites') return recipes || []
    const favs = friend.pantryIds || []
    return (recipes || []).filter((r) => favs.includes(r.id))
  }, [recipes, show, friend.pantryIds])

  // One section per category, in CATEGORIES order, same grouping as My Pantry, in
  // whatever order getFriendRecipes returned (no liked-first sort here).
  const sections = useMemo(() => {
    const order = [...CATEGORIES, OTHER]
    const byCat = new Map(order.map((c) => [c, []]))
    for (const r of visible) {
      const p = primaryCategory(r)
      byCat.get(CATEGORIES.includes(p) ? p : OTHER).push(r)
    }
    return [...byCat].filter(([, list]) => list.length > 0).map(([category, list]) => ({ category, list }))
  }, [visible])

  // Same pre-existing quirk as RecipeCard's own heart: it reflects *your* pantry,
  // not anything the friend has marked -- out of scope for this task (see card).
  const isLiked = (id) => pantryIds.includes(id)
  const openRecipe = (id) => navigate(`/recipe/${id}`, { state: { from: location.pathname } })

  // Portaled to <body>: a `position: fixed` overlay nested inside the page inherits
  // any transform/filter an ancestor has (the page's fade-in animation is one), which
  // makes "fixed" behave like "absolute" on some phones and clips the overlay.
  return createPortal(
    // Every edge respects the phone's safe areas (notch/Dynamic Island on top, home
    // indicator on the bottom, rounded corners on the sides in landscape) — without
    // these, content slides under the status bar and past the bottom of the screen.
    // `bottom` reaches over the strip iOS home-screen apps leave under fixed overlays
    // (see useStandaloneBottomGap, same fix as PdfPreview): without it the page stops
    // ~59px short of the screen with a bare cream band below the cut-off recipes.
    <div className="fixed inset-0 z-[70] overflow-y-auto overscroll-contain bg-eggshell" style={{ bottom: -bottomGap }}>
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
        {recipes != null && recipes.length > 0 && (
          <div className="mb-5 flex items-center justify-between gap-3">
            <FavoritesToggle value={show} onChange={setShow} />
            <ViewToggle view={view} onChange={setViewPersist} />
          </div>
        )}
        {recipes == null ? (
          <GridSkeleton count={3} />
        ) : recipes.length === 0 ? (
          <p className="text-warm-soft">No recipes to show yet.</p>
        ) : visible.length === 0 ? (
          <p className="text-warm-soft">{friend.displayName} hasn't favorited any of their recipes yet.</p>
        ) : (
          <div className="space-y-8">
            {sections.map(({ category, list }) => {
              const open = expanded.includes(category)
              const shown = open ? list : list.slice(0, PREVIEW_COUNT)
              const hidden = list.length - PREVIEW_COUNT
              return (
                <section key={category} className="space-y-3">
                  <h2 className="flex items-center gap-2 text-xl font-extrabold">
                    <CategoryIcon category={category} className="h-5 w-5 text-zinc-800" />
                    {category}
                    <span className="text-sm font-bold text-warm-soft">{list.length}</span>
                  </h2>
                  {view === 'list' ? (
                    <RecipeListView recipes={shown} isLiked={isLiked} onOpen={openRecipe}
                      showPocket onPocket={onPocket} pocketLabel="Copy to Pantry" />
                  ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {shown.map((r) => (
                        <RecipeCard key={r.id} recipe={r} showPocket pocketLabel="Copy to Pantry" onPocket={onPocket} />
                      ))}
                    </div>
                  )}
                  {hidden > 0 && (
                    <button
                      onClick={() => toggleExpanded(category)}
                      aria-expanded={open}
                      className="w-full rounded-2xl border border-warm/15 bg-white py-2.5 text-sm font-bold text-warm shadow-card transition active:scale-[.98] hover:bg-eggshell"
                    >
                      {open ? 'Show fewer' : `See all ${category} (${hidden} more)`}
                    </button>
                  )}
                </section>
              )
            })}
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
      const result = await fs.sendFriendRequest(me, u.id)
      toast(result === 'friends' ? `You and ${u.displayName} are now friends`
        : result === 'pending' ? 'Already requested' : 'Friend request sent')
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

// Heart + count, bottom right of a post card. The heart likes/unlikes; the count (only
// shown once someone has liked it) opens the list of who did.
function LikeButton({ post, liked, onToggle, onShowLikes }) {
  const count = likeCount(post)
  return (
    <div className="flex shrink-0 items-center" data-post-likes>
      <button onClick={() => { tap(); onToggle() }} aria-pressed={liked} aria-label={liked ? 'Unlike' : 'Like'}
        className="flex h-10 w-10 items-center justify-center rounded-full text-warm-soft transition active:scale-90">
        <HeartIcon filled={liked} className="h-6 w-6" />
      </button>
      {count > 0 && (
        <button onClick={onShowLikes} aria-label={`${count} ${count === 1 ? 'like' : 'likes'}, see who`} data-post-like-count
          className="-ml-1.5 flex h-10 min-w-[2rem] items-center justify-start rounded-full pl-1 pr-2 text-sm font-bold tabular-nums text-warm hover:underline">
          {count}
        </button>
      )}
    </div>
  )
}

// Who liked a post: a small bottom sheet with each person's avatar (initial fallback)
// and name. Me first as "You".
function LikesSheet({ likers, onClose }) {
  useScrollLock()
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-warm/40 sm:items-center sm:p-6" onClick={onClose}>
      <div data-likes-sheet onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md animate-fadein rounded-t-3xl bg-eggshell px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-4 sm:rounded-3xl sm:pb-5">
        <div className="mb-2 flex items-center gap-2">
          <HeartIcon filled className="h-5 w-5" />
          <h2 className="flex-1 text-lg font-extrabold">
            {likers.length} {likers.length === 1 ? 'like' : 'likes'}
          </h2>
          <button onClick={onClose} aria-label="Close" className="-mr-2 flex h-9 w-9 items-center justify-center rounded-full text-warm-soft hover:bg-white">
            <X className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        {likers.length === 0 ? (
          <p className="py-2 text-sm text-warm-soft">No likes yet.</p>
        ) : (
          <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
            {likers.map((l) => (
              <li key={l.uid} className="flex items-center gap-3 py-1.5">
                <span className="relative shrink-0">
                  <Avatar user={{ displayName: l.avatarName, avatarUrl: l.avatarUrl }} />
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-white shadow-card">
                    <HeartIcon filled className="h-3 w-3" />
                  </span>
                </span>
                <span className="min-w-0 truncate font-bold">{l.name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>,
    document.body,
  )
}

function Avatar({ user, big }) {
  const size = big ? 'h-16 w-16 text-2xl' : 'h-10 w-10'
  // A broken avatar URL (deleted file, Storage unavailable) falls back to the same
  // initial-letter circle as no avatar at all, instead of a broken-image glyph.
  const initial = (
    <span className={`${size} flex items-center justify-center rounded-full bg-peach font-extrabold text-warm`}>
      {(user.displayName || '?')[0].toUpperCase()}
    </span>
  )
  return <SafeImage src={user.avatarUrl} alt="" className={`${size} rounded-full object-cover`} fallback={initial} />
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
