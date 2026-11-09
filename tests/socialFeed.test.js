import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  FEED_TTL_DAYS, isPostExpired, liveFeedPosts, formatPostDate, normalizeIngredientName,
  findLikelyDuplicate, planExpiry,
} from '../src/lib/socialFeed.js'

const NOW = Date.UTC(2026, 10, 8, 18, 0)
const DAY = 86400000
const ing = (...names) => names.map((name) => ({ qty: '1', unit: 'cup', name }))
const ts = (ms) => ({ toMillis: () => ms }) // Firestore Timestamp shape

test('feed: only posted, unexpired, newest first; friend with no posts contributes nothing', () => {
  const recipes = [
    { id: 'old', authorId: 'a', postedToFeed: true, postedAt: ts(NOW - (FEED_TTL_DAYS + 1) * DAY) },
    { id: 'new', authorId: 'a', postedToFeed: true, postedAt: ts(NOW - DAY) },
    { id: 'newer', authorId: 'b', postedToFeed: true, postedAt: ts(NOW - 60000) },
    { id: 'unposted', authorId: 'c', postedToFeed: false, postedAt: ts(NOW) },
    { id: 'never', authorId: 'c' },
    { id: 'pending', authorId: 'b', postedToFeed: true, postedAt: null }, // serverTimestamp not landed yet
  ]
  assert.deepEqual(liveFeedPosts(recipes, NOW).map((r) => r.id), ['pending', 'newer', 'new'])
  assert.ok(!liveFeedPosts(recipes, NOW).some((r) => r.authorId === 'c'))
})

test('expiry boundary is 30 days', () => {
  assert.equal(isPostExpired({ postedAt: ts(NOW - 30 * DAY + 1000) }, NOW), false)
  assert.equal(isPostExpired({ postedAt: ts(NOW - 30 * DAY - 1000) }, NOW), true)
  assert.equal(isPostExpired({ postedAt: { seconds: (NOW - 40 * DAY) / 1000 } }, NOW), true)
})

test('date format: relative for a week, then the date', () => {
  assert.equal(formatPostDate(ts(NOW - 10000), NOW), 'just now')
  assert.equal(formatPostDate(ts(NOW - 5 * 60000), NOW), '5m ago')
  assert.equal(formatPostDate(ts(NOW - 3 * 3600000), NOW), '3h ago')
  assert.equal(formatPostDate(ts(NOW - 2 * DAY), NOW), '2d ago')
  assert.equal(formatPostDate(ts(Date.UTC(2026, 9, 20, 18)), NOW), 'Oct 20')
  assert.equal(formatPostDate(ts(Date.UTC(2025, 9, 20, 18)), NOW), 'Oct 20, 2025')
})

test('ingredient names: quantity, unit, prep notes stripped', () => {
  assert.equal(normalizeIngredientName({ name: 'onion, finely diced (about 1 large)' }), 'onion')
  assert.equal(normalizeIngredientName({ name: 'Fresh Tomatoes' }), 'tomato')
  assert.equal(normalizeIngredientName('2 cups chopped kidney beans'), 'kidney bean')
  assert.equal(normalizeIngredientName({ name: 'ground beef' }), 'beef')
  assert.equal(normalizeIngredientName({ name: 'molasses' }), 'molasses')
})

const chili = { id: 'post-chili', title: 'Smoky Weeknight Chili',
  ingredients: ing('ground beef', 'onion, diced', 'kidney beans', 'crushed tomatoes', 'chili powder', 'cumin', 'garlic') }

test('duplicate: near-identical ingredients (6 of 7 shared) flags the existing recipe by name', () => {
  const mine = { id: 'm1', title: "Mom's Chili",
    ingredients: ing('beef', 'onions', 'kidney bean', 'tomatoes', 'chili powder', 'cumin') }
  const hit = findLikelyDuplicate(chili, [{ id: 'x', title: 'Pancakes', ingredients: ing('flour', 'egg', 'milk') }, mine])
  assert.equal(hit?.recipe.title, "Mom's Chili")
  assert.equal(hit.reason, 'ingredients')
})

test('duplicate: unrelated recipe / under 5 shared / under 75% does not flag', () => {
  const choc = { id: 'p', title: 'Choc Chip Cookies', ingredients: ing('flour', 'butter', 'sugar', 'egg', 'chocolate chips', 'vanilla', 'baking soda') }
  const oat = { id: 'o', title: 'Oatmeal Cookies', ingredients: ing('flour', 'butter', 'sugar', 'egg', 'oats', 'raisins', 'cinnamon') }
  assert.equal(findLikelyDuplicate(choc, [oat]), null) // 4 shared of 10
  const curry = { id: 'c', title: 'Thai Curry', ingredients: ing('coconut milk', 'curry paste', 'chicken', 'basil', 'fish sauce') }
  assert.equal(findLikelyDuplicate(chili, [curry]), null)
  const tiny = { id: 't', title: 'Toast', ingredients: ing('bread', 'butter', 'salt') }
  assert.equal(findLikelyDuplicate({ id: 'p2', title: 'Butter toast', ingredients: ing('bread', 'butter', 'salt') }, [tiny]), null) // 100% but only 3
  // 5 shared but 5/8 = 62.5% < 75%
  const partial = { id: 'q', title: 'Beef stew', ingredients: ing('ground beef', 'onion', 'kidney beans', 'tomatoes', 'cumin', 'carrot') }
  assert.equal(findLikelyDuplicate(chili, [partial]), null)
})

test('duplicate: same post already copied, or same title, flags too', () => {
  assert.equal(findLikelyDuplicate(chili, [{ id: 'z', title: 'whatever', originalRecipeId: 'post-chili', ingredients: [] }])?.reason, 'same-post')
  assert.equal(findLikelyDuplicate(chili, [{ id: 'z', title: 'smoky weeknight chili!', ingredients: [] }])?.reason, 'same-title')
})

test('expiry plan: unflag + repoint to compressed + delete full-res only when safe', () => {
  const old = ts(NOW - 31 * DAY)
  const plan = planExpiry([
    { id: 'a', postedToFeed: true, postedAt: old, imageUrl: 'full-a', imageUrlCompressed: 'small-a' },
    { id: 'b', postedToFeed: true, postedAt: old, imageUrl: 'full-b' }, // no compressed: keep photo
    { id: 'c', postedToFeed: true, postedAt: old, imageUrl: 'full-c', imageUrlCompressed: 'small-c' },
    { id: 'c2', imageUrl: 'full-c' }, // another of my recipes still shows full-c
    { id: 'd', postedToFeed: true, postedAt: ts(NOW - DAY), imageUrl: 'full-d', imageUrlCompressed: 'small-d' },
  ], NOW)
  assert.deepEqual(plan, [
    { id: 'a', update: { postedToFeed: false, imageUrl: 'small-a' }, deleteUrl: 'full-a' },
    { id: 'b', update: { postedToFeed: false }, deleteUrl: null },
    { id: 'c', update: { postedToFeed: false, imageUrl: 'small-c' }, deleteUrl: null },
  ])
})
