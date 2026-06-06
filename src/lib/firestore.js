import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
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

const recipesCol = collection(db, 'recipes')

// ---------- Recipes ----------

export function listenMyRecipes(uid, cb) {
  // All Recipes = everything this user owns (created or pocketed).
  const q = query(recipesCol, where('authorId', '==', uid), orderBy('createdAt', 'desc'))
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    // Index-not-ready / offline fall back to an unordered read.
    () => {
      const q2 = query(recipesCol, where('authorId', '==', uid))
      onSnapshot(q2, (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))))
    },
  )
}

export async function getRecipe(id) {
  const snap = await getDoc(doc(db, 'recipes', id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function createRecipe(data, user, extra = {}) {
  const ref = await addDoc(recipesCol, {
    title: data.title || 'Untitled',
    category: data.category || 'Dinner',
    ingredients: data.ingredients || [],
    instructions: data.instructions || [],
    prepTime: data.prepTime || { value: 0, unit: 'min' },
    cookTime: data.cookTime || { value: 0, unit: 'min' },
    servings: Number(data.servings) || 1,
    imageUrl: data.imageUrl || '',
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
export async function seedIfEmpty(user) {
  const existing = await getDocs(query(recipesCol, where('authorId', '==', user.uid)))
  if (!existing.empty) return
  const batch = writeBatch(db)
  for (const r of sampleRecipes) {
    const ref = doc(recipesCol)
    batch.set(ref, {
      ...r,
      authorId: user.uid,
      authorName: user.displayName || 'Me',
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

// Search users by display name (case-sensitive prefix via Firestore range).
export async function searchUsers(term, excludeUid) {
  if (!term.trim()) return []
  const end = term + ''
  const q = query(usersCol, where('displayName', '>=', term), where('displayName', '<=', end))
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((u) => u.id !== excludeUid)
}

export async function sendFriendRequest(fromUser, toUserId) {
  await addDoc(requestsCol, {
    fromUserId: fromUser.uid,
    fromDisplayName: fromUser.displayName || 'Someone',
    toUserId,
    status: 'pending',
    createdAt: serverTimestamp(),
  })
}

// Incoming pending requests for me.
export function listenIncomingRequests(uid, cb) {
  const q = query(requestsCol, where('toUserId', '==', uid), where('status', '==', 'pending'))
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => cb([]))
}

export async function respondToRequest(request, accept, myUid) {
  await updateDoc(doc(db, 'friendRequests', request.id), {
    status: accept ? 'accepted' : 'declined',
  })
  if (accept) {
    // Add each user to the other's friend list.
    await updateDoc(doc(db, 'users', myUid), { friendIds: arrayUnion(request.fromUserId) })
    await updateDoc(doc(db, 'users', request.fromUserId), { friendIds: arrayUnion(myUid) })
  }
}

export async function getUsersByIds(ids = []) {
  const out = []
  for (const id of ids) {
    const snap = await getDoc(doc(db, 'users', id))
    if (snap.exists()) out.push({ id: snap.id, ...snap.data() })
  }
  return out
}

export async function removeFriend(myUid, friendId) {
  await updateDoc(doc(db, 'users', myUid), { friendIds: arrayRemove(friendId) })
  await updateDoc(doc(db, 'users', friendId), { friendIds: arrayRemove(myUid) })
}

// A friend's public recipes.
export async function getPublicRecipesOf(authorId) {
  const q = query(recipesCol, where('authorId', '==', authorId), where('isPublic', '==', true))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}
