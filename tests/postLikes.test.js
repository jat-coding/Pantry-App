import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  likeCount, hasLiked, toggleLikeLocal, likersList, likeName, LIKE_NAME_MAX, photoToDeleteWithPost,
} from '../src/lib/socialFeed.js'

test('old posts without likes count as zero, not liked', () => {
  assert.equal(likeCount({}), 0)
  assert.equal(likeCount({ likes: null }), 0)
  assert.equal(hasLiked({}, 'a'), false)
  assert.equal(hasLiked({ likes: { a: 'A' } }, null), false)
})

test('toggleLikeLocal adds then removes only my key, never mutates', () => {
  const p = { id: 'p', likes: { b: 'Bee' } }
  const liked = toggleLikeLocal(p, 'a', 'Ann')
  assert.deepEqual(liked.likes, { b: 'Bee', a: 'Ann' })
  assert.deepEqual(p.likes, { b: 'Bee' })
  assert.equal(likeCount(liked), 2)
  assert.deepEqual(toggleLikeLocal(liked, 'a', 'Ann').likes, { b: 'Bee' })
})

test('like names are trimmed, capped to the rules limit, never blank', () => {
  assert.equal(likeName('  Jo  '), 'Jo')
  assert.equal(likeName(''), 'Someone')
  assert.equal(likeName('x'.repeat(200)).length, LIKE_NAME_MAX)
})

test('likersList: me first as You, then A-Z, current names win over saved', () => {
  const post = { likes: { z: 'Zed', me: 'Old Me', b: 'Old Bob' } }
  const people = new Map([['b', { displayName: 'Bob', avatarUrl: 'u' }], ['me', { displayName: 'Ronnie' }]])
  const l = likersList(post, people, 'me')
  assert.deepEqual(l.map((x) => x.name), ['You', 'Bob', 'Zed'])
  assert.equal(l[0].avatarName, 'Ronnie')
  assert.equal(l[1].avatarUrl, 'u')
})

test('deleting a post keeps a photo still used elsewhere', () => {
  const post = { id: '1', imageUrl: 'A' }
  assert.equal(photoToDeleteWithPost(post, [post], []), 'A')
  assert.equal(photoToDeleteWithPost(post, [post, { id: '2', imageUrl: 'A' }], []), null)
  assert.equal(photoToDeleteWithPost(post, [post], [{ imageUrl: 'A' }]), null)
  assert.equal(photoToDeleteWithPost({ id: '1', imageUrl: '' }, [], []), null)
})
