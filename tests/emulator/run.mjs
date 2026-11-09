// Scenarios for tests/emulator/friend-requests.sh: every way a request could double up.
import assert from 'node:assert/strict'
async function as(uid) { globalThis.__UID = uid; return import('./.out/bundle.mjs?u=' + uid) }
const A = await as('steph'), B = await as('jat'), C = await as('beth'), D = await as('dad'), E = await as('mo')
const me = (uid, name) => ({ uid, displayName: name })
// seed users via REST with emulator owner bypass
const base = 'http://127.0.0.1:8089/v1/projects/demo-pantry/databases/(default)/documents'
const H = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }
for (const u of ['steph','jat','beth','dad','mo']) await fetch(`${base}/users/${u}`, { method: 'PATCH', headers: H, body: JSON.stringify({ fields: { displayName: { stringValue: u }, friendIds: { arrayValue: {} } } }) })
async function all() {
  const r = await (await fetch(`${base}/friendRequests?pageSize=100`, { headers: H })).json()
  return (r.documents || []).map((d) => ({ id: d.name.split('/').pop(), ...Object.fromEntries(Object.entries(d.fields).map(([k, v]) => [k, Object.values(v)[0]])) }))
}
const between = async (a, b) => (await all()).filter((r) => (r.fromUserId === a && r.toUserId === b) || (r.fromUserId === b && r.toUserId === a))

// 1. search-add twice in a row (the Stephanie case)
console.log('1', await A.sendFriendRequest(me('steph','Steph'), 'jat'), await A.sendFriendRequest(me('steph','Steph'), 'jat'))
assert.equal((await between('steph','jat')).length, 1)
// 2. double tap: two concurrent calls
console.log('2', await Promise.all([C.sendFriendRequest(me('beth','Beth'), 'mo'), C.sendFriendRequest(me('beth','Beth'), 'mo')]))
assert.equal((await between('beth','mo')).length, 1)
// 3. invite link with token opened twice (sequential, then concurrent for another pair)
const tok = await B.getOrCreateInviteToken('jat')
console.log('3a', await D.acceptInvite(me('dad','Dad'), 'jat', tok), await D.acceptInvite(me('dad','Dad'), 'jat', tok))
assert.equal((await between('dad','jat')).length, 1)
const tokMo = await E.getOrCreateInviteToken('mo')
console.log('3b', await Promise.all([D.acceptInvite(me('dad','Dad'), 'mo', tokMo), D.acceptInvite(me('dad','Dad'), 'mo', tokMo)]))
assert.equal((await between('dad','mo')).length, 1)
// 4. old no-token link twice
console.log('4', await C.acceptInvite(me('beth','Beth'), 'jat', null), await C.acceptInvite(me('beth','Beth'), 'jat', null))
assert.equal((await between('beth','jat')).length, 1)
// 5. search-add, then the token invite link: still one doc, now accepted
await A.sendFriendRequest(me('steph','Steph'), 'mo')
console.log('5', await A.acceptInvite(me('steph','Steph'), 'mo', tokMo))
let r5 = await between('steph','mo'); assert.equal(r5.length, 1); assert.equal(r5[0].status, 'accepted')
// 6. reverse direction: jat adds steph who already asked jat -> accepts hers, no new doc
console.log('6', await B.sendFriendRequest(me('jat','Jat'), 'steph'))
let r6 = await between('steph','jat'); assert.equal(r6.length, 1); assert.equal(r6[0].status, 'accepted')
// 7. after accepted, adding again either way is a no-op
console.log('7', await A.sendFriendRequest(me('steph','Steph'), 'jat'), await B.sendFriendRequest(me('jat','Jat'), 'steph'))
assert.equal((await between('steph','jat')).length, 1)
// 8. bad token still refused (no forged friendship)
await assert.rejects(C.acceptInvite(me('beth','Beth'), 'dad', 'wrong'))
// 9. legacy duplicate docs (random ids, like the live data): one row, answering it answers both
for (const id of ['legacy1','legacy2']) await fetch(`${base}/friendRequests/${id}`, { method: 'PATCH', headers: H, body: JSON.stringify({ fields: { fromUserId: { stringValue: 'mo' }, toUserId: { stringValue: 'beth' }, fromDisplayName: { stringValue: 'Mo' }, status: { stringValue: 'pending' }, createdAt: { timestampValue: id === 'legacy1' ? '2026-11-09T03:36:03Z' : '2026-11-09T03:38:35Z' } } }) })
// beth also has a pending to mo from test 2; mo->beth legacy ones are separate direction
const rows = await new Promise((res) => { const un = C.listenIncomingRequests('beth', (l) => { un?.(); res(l) }) })
console.log('9 rows', rows.map((r) => [r.fromUserId, r.ids]))
assert.equal(rows.filter((r) => r.fromUserId === 'mo').length, 1)
await C.respondToRequest(rows.find((r) => r.fromUserId === 'mo'), true, 'beth')
const leg = (await all()).filter((r) => r.id.startsWith('legacy'))
assert.deepEqual(leg.map((r) => r.status), ['accepted', 'accepted'])
console.log('ALL PASS', (await all()).map((r) => `${r.id}:${r.status}`).join(' '))
process.exit(0)
