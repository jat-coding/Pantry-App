import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  FEED_TTL_DAYS, isPostExpired, liveFeedPosts, formatPostDate, normalizeIngredientName,
  findLikelyDuplicate, planPostExpiry, matchesRecipeSearch, normalizeCaption, CAPTION_MAX,
} from '../src/lib/socialFeed.js'

const NOW = Date.UTC(2026, 10, 8, 18, 0)
const DAY = 86400000
const ing = (...names) => names.map((name) => ({ qty: '1', unit: 'cup', name }))
const ts = (ms) => ({ toMillis: () => ms }) // Firestore Timestamp shape

test('feed: posts are their own docs; same recipe posted twice = two entries, newest first', () => {
  const posts = [
    { id: 'old', authorId: 'a', recipeId: 'r1', postedAt: ts(NOW - (FEED_TTL_DAYS + 1) * DAY) },
    { id: 'chili-1', authorId: 'a', recipeId: 'chili', imageUrl: 'photo-1', postedAt: ts(NOW - 2 * DAY) },
    { id: 'chili-2', authorId: 'a', recipeId: 'chili', imageUrl: 'photo-2', postedAt: ts(NOW - 60000) },
    { id: 'other', authorId: 'b', recipeId: 'r2', postedAt: ts(NOW - DAY) },
    { id: 'no-recipe', authorId: 'b', postedAt: ts(NOW) }, // malformed: nothing to open
    { id: 'pending', authorId: 'b', recipeId: 'r3', postedAt: null }, // serverTimestamp not landed yet
  ]
  const live = liveFeedPosts(posts, NOW)
  assert.deepEqual(live.map((p) => p.id), ['pending', 'chili-2', 'other', 'chili-1'])
  assert.deepEqual(live.filter((p) => p.recipeId === 'chili').map((p) => p.imageUrl), ['photo-2', 'photo-1'])
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

test('post expiry: past 30 days -> delete the post doc and its photo file', () => {
  const old = ts(NOW - 31 * DAY)
  const plan = planPostExpiry([
    { id: 'a', postedAt: old, imageUrl: 'photo-a' },
    { id: 'b', postedAt: ts(NOW - DAY), imageUrl: 'photo-b' },
    { id: 'c', postedAt: old, imageUrl: '' }, // no photo: just the doc
  ], NOW)
  assert.deepEqual(plan, { deleteIds: ['a', 'c'], deleteUrls: ['photo-a'] })
})

test('post expiry: a photo shared by two posts is deleted once, and only when both are gone', () => {
  const old = ts(NOW - 31 * DAY)
  // Both expired: one delete, not two.
  assert.deepEqual(planPostExpiry([
    { id: 'a', postedAt: old, imageUrl: 'same' },
    { id: 'b', postedAt: ts(NOW - 40 * DAY), imageUrl: 'same' },
  ], NOW), { deleteIds: ['a', 'b'], deleteUrls: ['same'] })
  // One still live: the expired doc goes, the file stays.
  assert.deepEqual(planPostExpiry([
    { id: 'a', postedAt: old, imageUrl: 'same' },
    { id: 'b', postedAt: ts(NOW - DAY), imageUrl: 'same' },
  ], NOW), { deleteIds: ['a'], deleteUrls: [] })
  // A file one of my recipes shows is never deleted.
  assert.deepEqual(planPostExpiry([{ id: 'a', postedAt: old, imageUrl: 'recipe-photo' }], NOW,
    [{ id: 'r', imageUrl: 'recipe-photo' }]), { deleteIds: ['a'], deleteUrls: [] })
  // Nothing expiring: nothing to do.
  assert.deepEqual(planPostExpiry([{ id: 'b', postedAt: ts(NOW - DAY), imageUrl: 'x' }], NOW), { deleteIds: [], deleteUrls: [] })
})

test('recipe picker search: every word, case-insensitive, blank = all', () => {
  const r = { title: 'Smoky Weeknight Chili' }
  assert.equal(matchesRecipeSearch(r, ''), true)
  assert.equal(matchesRecipeSearch(r, '  '), true)
  assert.equal(matchesRecipeSearch(r, 'chili'), true)
  assert.equal(matchesRecipeSearch(r, 'CHILI smoky'), true)
  assert.equal(matchesRecipeSearch(r, 'chili beans'), false)
  assert.equal(matchesRecipeSearch({}, 'x'), false)
})

test('caption: trimmed, blank is empty, old posts (no field) are empty, capped', () => {
  assert.equal(normalizeCaption('  Made this for Sunday dinner  '), 'Made this for Sunday dinner')
  assert.equal(normalizeCaption('   \n\t '), '')
  assert.equal(normalizeCaption(undefined), '')
  assert.equal(normalizeCaption(null), '')
  assert.equal(normalizeCaption('line one\r\n\r\n\r\n\r\nline two'), 'line one\n\nline two')
  assert.equal(normalizeCaption('x'.repeat(CAPTION_MAX + 50)).length, CAPTION_MAX)
})
