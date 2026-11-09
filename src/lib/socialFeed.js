// Social feed rules, kept free of Firebase so they can be unit-tested
// (tests/socialFeed.test.js). The Firestore/Storage side lives in firestore.js and
// imageSnapshot.js; the screen is Friends.jsx.

// A post leaves the feed this long after it was posted (his call: "clear images after
// a month", tap answer: vanish from the feed entirely).
export const FEED_TTL_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

// Firestore Timestamp, Date, millis, or a pending serverTimestamp (null until the
// write lands -- treated as "just now" so a fresh post never looks expired).
export function toMillis(t) {
  if (t == null) return null
  if (typeof t === 'number') return t
  if (t instanceof Date) return t.getTime()
  if (typeof t.toMillis === 'function') return t.toMillis()
  if (typeof t.seconds === 'number') return t.seconds * 1000
  return null
}

export function isPostExpired(recipe, now = Date.now()) {
  const at = toMillis(recipe?.postedAt)
  return at != null && now - at > FEED_TTL_DAYS * DAY_MS
}

// What the feed actually renders: still flagged, not expired, newest first.
export function liveFeedPosts(recipes, now = Date.now()) {
  return recipes
    .filter((r) => r.postedToFeed === true && !isPostExpired(r, now))
    .sort((a, b) => (toMillis(b.postedAt) ?? now) - (toMillis(a.postedAt) ?? now))
}

// "just now" / "5m ago" / "3h ago" / "2d ago" for the first week, then the date.
export function formatPostDate(t, now = Date.now()) {
  const at = toMillis(t) ?? now
  const diff = Math.max(0, now - at)
  if (diff < 60 * 1000) return 'just now'
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < DAY_MS) return `${Math.floor(diff / 3600000)}h ago`
  if (diff < 7 * DAY_MS) return `${Math.floor(diff / DAY_MS)}d ago`
  const d = new Date(at)
  const sameYear = d.getFullYear() === new Date(now).getFullYear()
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) })
}

// ---------- Duplicate check (social-feed copy only) ----------

// Locked on the task card: stricter than the 60%/4 first proposal.
export const DUP_MIN_OVERLAP = 0.75
export const DUP_MIN_SHARED = 5

const UNITS = new Set([
  'cup', 'cups', 'c', 'tbsp', 'tbs', 'tablespoon', 'tablespoons', 'tsp', 'teaspoon', 'teaspoons',
  'oz', 'ounce', 'ounces', 'fl', 'lb', 'lbs', 'pound', 'pounds', 'g', 'gram', 'grams', 'kg',
  'ml', 'l', 'liter', 'liters', 'pinch', 'dash', 'clove', 'cloves', 'can', 'cans', 'package',
  'packages', 'pkg', 'stick', 'sticks', 'slice', 'slices', 'large', 'medium', 'small', 'whole',
  'of', 'a', 'an',
])
const PREP = new Set([
  'chopped', 'diced', 'minced', 'sliced', 'grated', 'shredded', 'melted', 'softened', 'fresh',
  'freshly', 'ground', 'crushed', 'peeled', 'finely', 'roughly', 'thinly', 'packed', 'divided',
  'optional', 'to', 'taste', 'room', 'temperature', 'and', 'or', 'for', 'serving',
])

function singular(w) {
  if (/(oes|ches|shes|xes)$/.test(w)) return w.slice(0, -2)
  if (/[^s]s$/.test(w) && !/ses$/.test(w)) return w.slice(0, -1)
  return w
}

// Just the ingredient's name: no quantity, unit or prep note, lowercased, trimmed.
// "2 cups onion, finely diced (about 1 large)" -> "onion".
export function normalizeIngredientName(ing) {
  const raw = typeof ing === 'string' ? ing : ing?.name || ''
  const words = raw
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .split(',')[0]
    .replace(/[^a-z\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !UNITS.has(w) && !PREP.has(w))
  // Plural-insensitive on the last word, so "tomatoes" and "tomato" match.
  if (words.length) words[words.length - 1] = singular(words[words.length - 1])
  return words.join(' ').trim()
}

export function ingredientNameSet(recipe) {
  return new Set((recipe?.ingredients || []).map(normalizeIngredientName).filter(Boolean))
}

const normTitle = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// The single best-matching recipe in `library` that `post` probably duplicates, or
// null. A match is: the same post already copied, the same title, or an ingredient
// list overlapping >= 75% (Jaccard) with at least 5 ingredients in common.
export function findLikelyDuplicate(post, library = []) {
  const mine = ingredientNameSet(post)
  const title = normTitle(post?.title)
  let best = null
  for (const r of library) {
    if (!r || r.id === post?.id) continue
    let score = 0
    let reason = null
    if (r.originalRecipeId && r.originalRecipeId === post?.id) { score = 2; reason = 'same-post' }
    else if (title && normTitle(r.title) === title) { score = 1.5; reason = 'same-title' }
    else {
      const theirs = ingredientNameSet(r)
      let shared = 0
      for (const n of mine) if (theirs.has(n)) shared++
      const union = mine.size + theirs.size - shared
      const overlap = union ? shared / union : 0
      if (shared >= DUP_MIN_SHARED && overlap >= DUP_MIN_OVERLAP) { score = overlap; reason = 'ingredients' }
    }
    if (reason && (!best || score > best.score)) best = { recipe: r, score, reason }
  }
  return best
}

// ---------- Expiry ----------

// What to do with my own recipes whose post is past 30 days: take it off the feed and
// point the recipe at its compressed record, then delete the full-res file -- but only
// when a compressed record exists (otherwise the recipe would lose its photo) and no
// other recipe of mine still shows that same file.
export function planExpiry(myRecipes = [], now = Date.now()) {
  const expiring = myRecipes.filter((r) => r.postedToFeed === true && isPostExpired(r, now))
  const ids = new Set(expiring.map((r) => r.id))
  return expiring.map((r) => {
    const swap = !!r.imageUrlCompressed && r.imageUrlCompressed !== r.imageUrl
    const stillUsed = myRecipes.some((o) => !ids.has(o.id) && o.imageUrl === r.imageUrl)
    return {
      id: r.id,
      update: swap ? { postedToFeed: false, imageUrl: r.imageUrlCompressed } : { postedToFeed: false },
      deleteUrl: swap && r.imageUrl && !stillUsed ? r.imageUrl : null,
    }
  })
}
