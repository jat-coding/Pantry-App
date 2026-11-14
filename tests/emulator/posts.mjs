// Scenarios for tests/emulator/posts.sh: who may like, unlike and delete a post.
import assert from 'node:assert/strict'
import { getApp } from 'firebase/app'
import { getFirestore, doc, updateDoc, deleteDoc, addDoc, collection, getDoc, deleteField, serverTimestamp } from 'firebase/firestore'
async function as(uid) { globalThis.__UID = uid; return import('./.out/bundle.mjs?u=' + uid) }
const S = await as('steph'), J = await as('jat'), B = await as('beth')
const raw = (uid) => getFirestore(getApp(uid))
const base = 'http://127.0.0.1:8089/v1/projects/demo-pantry/databases/(default)/documents'
const H = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }
const arr = (...ids) => ({ arrayValue: { values: ids.map((stringValue) => ({ stringValue })) } })
const seed = { steph: arr('jat'), jat: arr('steph'), beth: arr() }
for (const [u, f] of Object.entries(seed)) await fetch(`${base}/users/${u}`, { method: 'PATCH', headers: H, body: JSON.stringify({ fields: { displayName: { stringValue: u }, friendIds: f } }) })
const read = async (id) => { const r = await (await fetch(`${base}/posts/${id}`, { headers: H })).json(); return r.fields ? r : null }
const likesOf = async (id) => Object.keys((await read(id))?.fields?.likes?.mapValue?.fields || {}).sort()

const me = (uid) => ({ uid, displayName: uid })
const id = await S.createPost({ recipe: { id: 'r1', title: 'Soup' }, imageUrl: '', caption: 'hi' }, me('steph'), 'Steph')

// 1. a mutual friend likes, the poster likes their own, then the friend unlikes
await J.setPostLike(id, 'jat', 'Jat', true)
await S.setPostLike(id, 'steph', 'Steph', true)
assert.deepEqual(await likesOf(id), ['jat', 'steph'])
await J.setPostLike(id, 'jat', 'Jat', false)
assert.deepEqual(await likesOf(id), ['steph'])
await J.setPostLike(id, 'jat', 'Jat', true)
console.log('1 like/unlike ok', await likesOf(id))
// 2. someone who can't see the post can't like it
await assert.rejects(B.setPostLike(id, 'beth', 'Beth', true))
// 3. nobody can add or remove a like for someone else
await assert.rejects(updateDoc(doc(raw('jat'), 'posts', id), { 'likes.beth': 'Beth' }))
await assert.rejects(updateDoc(doc(raw('jat'), 'posts', id), { 'likes.steph': deleteField() }))
await assert.rejects(updateDoc(doc(raw('jat'), 'posts', id), { likes: {} }))
// 4. a like can't smuggle any other edit, and the name is capped
await assert.rejects(updateDoc(doc(raw('jat'), 'posts', id), { 'likes.jat': 'Jat', caption: 'pwned' }))
await assert.rejects(updateDoc(doc(raw('steph'), 'posts', id), { caption: 'edited' }))
await assert.rejects(updateDoc(doc(raw('jat'), 'posts', id), { 'likes.jat': 'x'.repeat(81) }))
await assert.rejects(updateDoc(doc(raw('jat'), 'posts', id), { 'likes.jat': 5 }))
// 5. a post can't be born with likes
await assert.rejects(addDoc(collection(raw('steph'), 'posts'), { authorId: 'steph', recipeId: 'r1', postedAt: serverTimestamp(), likes: { jat: 'Jat' } }))
console.log('2-5 refusals ok', await likesOf(id))
// 6. only the poster deletes
await assert.rejects(deleteDoc(doc(raw('jat'), 'posts', id)))
await assert.rejects(J.deletePost({ id, authorId: 'steph' }, 'jat'))
assert.ok(await read(id))
await S.deletePost({ id, authorId: 'steph', imageUrl: '' }, 'steph')
assert.equal(await read(id), null)
// 7. liking a post that was just deleted fails cleanly (the UI rolls the heart back)
await assert.rejects(J.setPostLike(id, 'jat', 'Jat', true))
assert.equal(await read(id), null)
console.log('ALL PASS')
process.exit(0)
