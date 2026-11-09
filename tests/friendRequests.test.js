import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dedupeIncoming, planFriendRequest, requestDocId } from '../src/lib/friendRequests.js'

const ts = (ms) => ({ toMillis: () => ms })

test('two pending requests from one sender show as one row, oldest first, carrying both ids', () => {
  // The real 2026-11-09 case: same sender, 2.5 minutes apart, newer one listed first.
  const rows = dedupeIncoming([
    { id: 'newer', fromUserId: 'steph', fromDisplayName: 'Stephanie', createdAt: ts(2000) },
    { id: 'older', fromUserId: 'steph', fromDisplayName: 'Stephanie', createdAt: ts(1000) },
    { id: 'beth1', fromUserId: 'beth', fromDisplayName: 'Beth', createdAt: ts(1500) },
  ])
  assert.equal(rows.length, 2)
  const steph = rows.find((r) => r.fromUserId === 'steph')
  assert.equal(steph.id, 'older')
  assert.deepEqual(steph.ids, ['older', 'newer'])
  assert.deepEqual(rows.find((r) => r.fromUserId === 'beth').ids, ['beth1'])
})

test('a just-written request (createdAt still null) does not crash or reorder ahead of real ones', () => {
  const rows = dedupeIncoming([
    { id: 'fresh', fromUserId: 'a', createdAt: null },
    { id: 'old', fromUserId: 'a', createdAt: ts(5) },
  ])
  assert.deepEqual(rows[0].ids, ['old', 'fresh'])
})

test('plan: nothing between us sends; my pending blocks a second send', () => {
  assert.equal(planFriendRequest([], []), 'send')
  assert.equal(planFriendRequest([{ status: 'pending' }], []), 'pending')
})

test('plan: they already asked me means accept theirs, not a crossing request', () => {
  assert.equal(planFriendRequest([], [{ status: 'pending' }]), 'accept')
})

test('plan: accepted either way means already friends', () => {
  assert.equal(planFriendRequest([{ status: 'accepted' }], []), 'friends')
  assert.equal(planFriendRequest([], [{ status: 'accepted' }]), 'friends')
  assert.equal(planFriendRequest([{ status: 'pending' }], [{ status: 'accepted' }]), 'friends')
})

test('plan: declined requests do not block asking again', () => {
  assert.equal(planFriendRequest([{ status: 'declined' }], [{ status: 'declined' }]), 'send')
})

test('request doc id is fixed per direction', () => {
  assert.equal(requestDocId('a', 'b'), 'a_b')
  assert.notEqual(requestDocId('a', 'b'), requestDocId('b', 'a'))
})
