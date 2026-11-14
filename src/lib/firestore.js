import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase.js'
import { sampleRecipes } from '../data/sampleRecipes.js'
import { likeName, liveFeedPosts, normalizeCaption, photoToDeleteWithPost, planPostExpiry } from './socialFeed.js'
import { deleteOwnImage } from './imageSnapshot.js'
import { dedupeIncoming, planFriendRequest, requestDocId } from './friendRequests.js'

const recipesCol = collection(db, 'recipes')
const postsCol = collection(db, 'posts')

// ---------- Recipes ----------

export function listenMyRecipes(uid, cb) {
  // Everything this user owns (created or pocketed): the Pantry screen lists all of it.
  const ordered = query(recipesCol, where('authorId', '==', uid), orderBy('createdAt', 'desc'))
  const unordered = query(recipesCol, where('authorId', '==', uid))
  const emit = (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))

  // Track the active subscription so the fallback is also cleaned up.
  let activeUnsub = onSnapshot(ordered, emit, () => {
    // Index-not-ready / offline → swap to an unordered read.
    activeUnsub = onSnapshot(unordered, emit)
  })
  return () => { if (activeUnsub) activeUnsub() }
}

export async function getRecipe(id) {
  const snap = await getDoc(doc(db, 'recipes', id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function createRecipe(data, user, extra = {}) {
  const categories = (Array.isArray(data.categories) && data.categories.length)
    ? data.categories
    : [data.category || 'Dinner']
  const ref = await addDoc(recipesCol, {
    title: data.title || 'Untitled',
    category: categories[0],
    categories,
    ingredients: data.ingredients || [],
    instructions: data.instructions || [],
    // Manual step -> ingredient picks from the editor (see src/lib/stepLinks.js).
    stepIngredientLinks: data.stepIngredientLinks || {},
    prepTime: data.prepTime || { value: 0, unit: 'min' },
    cookTime: data.cookTime || { value: 0, unit: 'min' },
    servings: Number(data.servings) || 1,
    imageUrl: data.imageUrl || '',
    // Was missing: the editor uploads the clip, sets form.videoUrl, and this literal
    // silently dropped it — so every NEW video recipe (and every pocketed one) saved
    // with no video and an orphaned file in Storage.
    videoUrl: data.videoUrl || '',
    // The page/video an imported recipe came from ("Original" on the recipe page).
    sourceUrl: data.sourceUrl || '',
    isPublic: !!data.isPublic,
    authorId: user.uid,
    authorName: user.displayName || 'Me',
    createdAt: serverTimestamp(),
    ...extra,
  })
  return ref.id
}

export function updateRecipe(id, data) {
  return updateDoc(doc(db, 'recipes', id), data)
}

export function deleteRecipe(id) {
  return deleteDoc(doc(db, 'recipes', id))
}

// Pocket a friend's recipe: copy into my library, crediting the author.
export async function pocketRecipe(recipe, user) {
  return createRecipe(recipe, user, {
    isPublic: false,
    pocketedFromId: recipe.authorId,
    pocketedFromName: recipe.authorName,
    originalRecipeId: recipe.id,
  })
}

// Seed starter recipes the first time a user signs in with an empty library.
//
// These are credited to Pantry, not the user — they didn't write them, and
// showing "by <name>" on a recipe someone never created is misleading once it
// reaches a friend's feed. Ownership (`authorId`) still has to be the user:
// the library query filters on it and the security rules gate every write on
// it, so they keep full control to edit or delete their starter recipes.
// Matches what guests already see (see guestSeed in DataContext).
export async function seedIfEmpty(user) {
  const existing = await getDocs(query(recipesCol, where('authorId', '==', user.uid)))
  if (!existing.empty) return
  const batch = writeBatch(db)
  for (const r of sampleRecipes) {
    const ref = doc(recipesCol)
    batch.set(ref, {
      ...r,
      authorId: user.uid,
      authorName: 'Pantry',
      createdAt: serverTimestamp(),
    })
  }
  await batch.commit()
}

// ---------- Pantry (favorites) ----------

export function togglePantry(uid, recipeId, isCurrentlyIn) {
  return updateDoc(doc(db, 'users', uid), {
    pantryIds: isCurrentlyIn ? arrayRemove(recipeId) : arrayUnion(recipeId),
  })
}

// ---------- Grocery list (subcollection users/{uid}/grocery) ----------

export function listenGrocery(uid, cb) {
  const col = collection(db, 'users', uid, 'grocery')
  return onSnapshot(col, (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
  )
}

export async function addGroceryItems(uid, items) {
  const batch = writeBatch(db)
  const col = collection(db, 'users', uid, 'grocery')
  for (const it of items) {
    batch.set(doc(col), {
      name: it.name,
      qty: it.qty ?? null,
      unit: it.unit || '',
      fromRecipe: it.fromRecipe || '',
      fromRecipeId: it.fromRecipeId || '',
      category: it.category || 'Other',
      checked: false,
      createdAt: serverTimestamp(),
    })
  }
  await batch.commit()
}

export function setGroceryChecked(uid, itemId, checked) {
  return updateDoc(doc(db, 'users', uid, 'grocery', itemId), { checked })
}

export function deleteGroceryItem(uid, itemId) {
  return deleteDoc(doc(db, 'users', uid, 'grocery', itemId))
}

export async function clearGrocery(uid, onlyCompleted) {
  const col = collection(db, 'users', uid, 'grocery')
  const snap = await getDocs(col)
  const batch = writeBatch(db)
  snap.forEach((d) => {
    if (!onlyCompleted || d.data().checked) batch.delete(d.ref)
  })
  await batch.commit()
}

// ---------- Profile ----------

export function updateProfileDoc(uid, data) {
  return setDoc(doc(db, 'users', uid), data, { merge: true })
}

// ---------- Friends ----------

const usersCol = collection(db, 'users')
const requestsCol = collection(db, 'friendRequests')

// Search users by display name, case-insensitive prefix via a lowercased field.
export async function searchUsers(term, excludeUid) {
  const t = term.trim().toLowerCase()
  if (!t) return []
  // '\uf8ff' sorts after ordinary characters, so this range is "starts with t". Kept
  // as an escape: the raw character is invisible and reads like an exact-match bug.
  const end = t + '\uf8ff'
  const q = query(usersCol, where('displayNameLower', '>=', t), where('displayNameLower', '<=', end))
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((u) => u.id !== excludeUid)
}

// Every request doc between me and them, both directions. Two equality filters on
// participants is what the read rule can prove, so no status filter here.
async function requestsBetween(myUid, otherUid) {
  const [mine, theirs] = await Promise.all([
    getDocs(query(requestsCol, where('fromUserId', '==', myUid), where('toUserId', '==', otherUid))),
    getDocs(query(requestsCol, where('fromUserId', '==', otherUid), where('toUserId', '==', myUid))),
  ])
  const list = (snap) => snap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }))
  return { mine: list(mine), theirs: list(theirs) }
}

// Write a request at the pair's fixed id. If one is already there the rules refuse the
// sender an update; that is the "already sent" case (two taps racing), not an error.
async function createRequest(fromUser, toUserId, extra) {
  try {
    await setDoc(doc(db, 'friendRequests', requestDocId(fromUser.uid, toUserId)), {
      fromUserId: fromUser.uid,
      fromDisplayName: fromUser.displayName || 'Someone',
      toUserId,
      createdAt: serverTimestamp(),
      ...extra,
    })
    return true
  } catch (e) {
    if (e?.code === 'permission-denied') return false
    throw e
  }
}

// Ask someone to be friends, unless something between us already settles it: they
// already asked me (accept theirs), we're already friends, or I already asked.
// Returns 'sent' | 'pending' | 'friends'.
export async function sendFriendRequest(fromUser, toUserId) {
  const { mine, theirs } = await requestsBetween(fromUser.uid, toUserId)
  const plan = planFriendRequest(mine, theirs)
  if (plan === 'friends') {
    await updateDoc(doc(db, 'users', fromUser.uid), { friendIds: arrayUnion(toUserId) })
    return 'friends'
  }
  if (plan === 'accept') {
    const pending = theirs.filter((r) => r.status === 'pending')
    await respondToRequest({ ...pending[0], ids: pending.map((r) => r.id) }, true, fromUser.uid)
    return 'friends'
  }
  if (plan === 'pending') return 'pending'
  // Clear my old declined ones first so the fixed id is free to create on.
  await Promise.all(mine.map((r) => deleteDoc(r.ref)))
  return (await createRequest(fromUser, toUserId, { status: 'pending' })) ? 'sent' : 'pending'
}

// Incoming pending requests for me.
export function listenIncomingRequests(uid, cb) {
  const q = query(requestsCol, where('toUserId', '==', uid), where('status', '==', 'pending'))
  return onSnapshot(q, (snap) => cb(dedupeIncoming(snap.docs.map((d) => ({ id: d.id, ...d.data() })))),
    () => cb([]))
}

// A row can stand for several duplicate docs from the same sender (request.ids); answer
// them all so a leftover copy doesn't pop the row straight back.
export async function respondToRequest(request, accept, myUid) {
  const status = accept ? 'accepted' : 'declined'
  await Promise.all((request.ids || [request.id]).map((id) =>
    updateDoc(doc(db, 'friendRequests', id), { status })))
  // Friendship is mutual and each side writes only its own list (see firestore.rules).
  // The recipient adds the sender here; the sender's client adds the recipient when it
  // sees the accepted request (syncAcceptedRequests).
  if (accept) await updateDoc(doc(db, 'users', myUid), { friendIds: arrayUnion(request.fromUserId) })
}

// Requests I sent that are still waiting on the other person, so the app never offers
// to add someone twice.
export function listenOutgoingRequests(uid, cb) {
  const q = query(requestsCol, where('fromUserId', '==', uid), where('status', '==', 'pending'))
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => d.data().toUserId)), () => cb([]))
}

// Requests I sent that were accepted. My client completes my half of the friendship.
export function listenAcceptedSent(uid, cb) {
  const q = query(requestsCol, where('fromUserId', '==', uid), where('status', '==', 'accepted'))
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => d.data().toUserId)), () => {})
}

export async function addFriendIds(myUid, ids) {
  if (!ids.length) return
  await updateDoc(doc(db, 'users', myUid), { friendIds: arrayUnion(...ids) })
}

export async function getUsersByIds(ids = []) {
  // One round trip per id, all in flight at once. Sequentially awaiting these was
  // the Friends tab's whole load time: 6 friends = 6 chained round trips.
  const snaps = await Promise.all(ids.map((id) => getDoc(doc(db, 'users', id)).catch(() => null)))
  return snaps
    .filter((snap) => snap && snap.exists())
    .map((snap) => ({ id: snap.id, ...snap.data() }))
}

export async function getUserById(id) {
  const snap = await getDoc(doc(db, 'users', id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

// My secret invite token (lives in users/{me}/private/invite, readable only by me).
// Created on first use; it is what lets someone who opens my link become my friend
// with no tap from me.
export async function getOrCreateInviteToken(uid) {
  const ref = doc(db, 'users', uid, 'private', 'invite')
  const snap = await getDoc(ref)
  if (snap.exists() && snap.data().token) return snap.data().token
  const token = (crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/-/g, '')
  await setDoc(ref, { token })
  return token
}

// Opening a friend's invite link. With the link's secret token the friendship is
// automatic: I add them to my list now, and their client adds me when it sees my
// pre-accepted request (syncAcceptedIncoming). Without a token (old links) it falls
// back to a normal request they must accept.
export async function acceptInvite(me, inviterId, token) {
  if (!me?.uid || !inviterId || me.uid === inviterId) return 'self'
  if (!token) return (await sendFriendRequest(me, inviterId)) === 'friends' ? 'friends' : 'requested'
  const { mine, theirs } = await requestsBetween(me.uid, inviterId)
  const plan = planFriendRequest(mine, theirs)
  if (plan === 'accept') return (await sendFriendRequest(me, inviterId)) === 'friends' ? 'friends' : 'requested'
  if (plan !== 'friends') {
    // My own pending/declined ones give way to the pre-accepted one at the same id.
    await Promise.all(mine.map((r) => deleteDoc(r.ref)))
    const created = await createRequest(me, inviterId, { status: 'accepted', inviteToken: token })
    if (!created) {
      // Refused: either the link was opened twice at once (the other open wrote it) or
      // the token is wrong. Only the first is fine.
      const again = await requestsBetween(me.uid, inviterId)
      if (planFriendRequest(again.mine, again.theirs) !== 'friends') throw new Error('invite refused')
    }
  }
  await updateDoc(doc(db, 'users', me.uid), { friendIds: arrayUnion(inviterId) })
  return 'friends'
}

// Requests sent TO me that are accepted (someone used my invite link). My client
// completes my half. The rules guarantee these only exist via my token or my own accept.
export function listenAcceptedIncoming(uid, cb) {
  const q = query(requestsCol, where('toUserId', '==', uid), where('status', '==', 'accepted'))
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => d.data().fromUserId)), () => {})
}

// Unfriend: drop them from my list and delete the request records between us so
// the accepted request can't re-add them. They keep a stale entry, but without
// mutuality it grants nothing and the app hides it.
export async function removeFriend(myUid, friendId) {
  await updateDoc(doc(db, 'users', myUid), { friendIds: arrayRemove(friendId) })
  for (const [from, to] of [[myUid, friendId], [friendId, myUid]]) {
    const snap = await getDocs(query(requestsCol, where('fromUserId', '==', from), where('toUserId', '==', to)))
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)))
  }
}

// A friend's public recipes.
export async function getPublicRecipesOf(authorId) {
  const q = query(recipesCol, where('authorId', '==', authorId), where('isPublic', '==', true))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// All of a friend's recipes (their pantry/collection). Security rules let you
// read recipes authored by someone in your friend list, public or not.
// Friends' pantries, cached for the session so reopening one paints instantly.
// Stale-while-revalidate: peek gives the last copy to render immediately, the
// fetch below still runs and replaces it, so nothing goes stale on screen.
const friendRecipeCache = new Map()

export function peekFriendRecipes(authorId) {
  return friendRecipeCache.get(authorId) || null
}

export async function getFriendRecipes(authorId) {
  const q = query(recipesCol, where('authorId', '==', authorId))
  const snap = await getDocs(q)
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  friendRecipeCache.set(authorId, list)
  return list
}

// Warm the cache for every friend while the phone is idle, so the first
// "View Pantry" tap is instant too. Never throws — this is best-effort.
export function prefetchFriendRecipes(ids = []) {
  const run = () => { for (const id of ids) getFriendRecipes(id).catch(() => {}) }
  if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 4000 })
  else setTimeout(run, 1200)
}

// ---------- Social feed ----------
// Rules live in src/lib/socialFeed.js. A post is its own doc in `posts` (not a flag on
// the recipe): its own photo, a link to one of my recipes, and a timestamp. The same
// recipe can be posted any number of times; each post is a separate feed entry.

// `imageUrl` is the post's own photo, already uploaded by the composer. `caption` is
// the poster's optional text; blank is stored as '' and renders as no caption.
export async function createPost({ recipe, imageUrl, caption }, user, authorName) {
  const ref = await addDoc(postsCol, {
    authorId: user.uid,
    authorName: authorName || user.displayName || 'Me',
    recipeId: recipe.id,
    recipeTitle: recipe.title || 'Untitled',
    imageUrl: imageUrl || '',
    caption: normalizeCaption(caption),
    postedAt: serverTimestamp(),
  })
  return ref.id
}

// Feed posts by these authors (my friends, plus me so I see my own posts), newest
// first, expired ones already dropped. One equality query per author, the same shape
// the rules allow for viewing a friend's pantry, so there is no 30-author `in` cap and
// no composite index to deploy.
export async function getFeedPosts(authorIds = []) {
  const lists = await Promise.all([...new Set(authorIds)].map((id) =>
    getDocs(query(postsCol, where('authorId', '==', id)))
      .then((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      .catch(() => [])))
  return liveFeedPosts(lists.flat())
}

// Lazy 30-day sweep over MY OWN posts (only the author may delete a post or its photo,
// so each person's app expires its own). Runs when my library loads. Best-effort: the
// feed already hides an expired post by date, and anything left over is retried next
// load.
export async function expireMyOldPosts(uid, myRecipes = []) {
  const snap = await getDocs(query(postsCol, where('authorId', '==', uid)))
  const myPosts = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const plan = planPostExpiry(myPosts, Date.now(), myRecipes)
  for (const id of plan.deleteIds) {
    try { await deleteDoc(doc(db, 'posts', id)) } catch { /* next load retries */ }
  }
  // Files only after their docs are gone, so the feed never shows a post whose photo
  // was already deleted.
  for (const url of plan.deleteUrls) await deleteOwnImage(url, uid)
  return plan
}

// The poster deletes one of their own posts (rules: author only). Doc first, then the
// photo file if nothing else of mine still shows it, so the feed never renders a post
// whose photo is already gone. Throws if the doc delete fails; the file is best-effort.
export async function deletePost(post, uid, myRecipes = []) {
  if (!post?.id || post.authorId !== uid) throw new Error('Only the poster can delete this post')
  await deleteDoc(doc(db, 'posts', post.id))
  let myPosts = []
  try {
    const snap = await getDocs(query(postsCol, where('authorId', '==', uid)))
    myPosts = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  } catch {
    return // can't tell if the photo is shared; leaving a file is safer than a broken image
  }
  const url = photoToDeleteWithPost(post, myPosts, myRecipes)
  if (url) await deleteOwnImage(url, uid)
}

// Like / unlike a post as me: sets or removes only my own key in the post's `likes`
// map (the rules refuse any other change). Field-path update, so two people liking at
// once never overwrite each other.
export async function setPostLike(postId, uid, name, liked) {
  await updateDoc(doc(db, 'posts', postId), {
    [`likes.${uid}`]: liked ? likeName(name) : deleteField(),
  })
}
