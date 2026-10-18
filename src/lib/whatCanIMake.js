// Pure helpers for the Grocery tab's "What Can I Make?" search.

// Score each recipe by how many of the given ingredients it uses. Unsorted;
// recipes that use none of them are dropped.
export function rankByPantry(recipes, pills) {
  return recipes
    .map((r) => {
      const names = (r.ingredients || []).map((i) => (i.name || '').toLowerCase())
      const have = pills.filter((p) => names.some((n) => n.includes(p)))
      const total = names.length
      return { recipe: r, have: have.length, total, missing: total - have.length, pct: total ? have.length / total : 0 }
    })
    .filter((x) => x.have > 0)
}

// 'percent' = best match first (4/4 beats 5/20); 'count' = most ingredients used.
export function sortRanked(ranked, mode = 'percent') {
  const byPct = (a, b) => b.pct - a.pct
  const byHave = (a, b) => b.have - a.have
  const primary = mode === 'count' ? [byHave, byPct] : [byPct, byHave]
  return [...ranked].sort((a, b) => primary[0](a, b) || primary[1](a, b) || a.missing - b.missing)
}

const norm = (s) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ')

// Same title + same set of ingredient names = same recipe, whoever's copy it is.
// Every account is seeded with its own private copy of the starter recipes (fresh
// doc ids, nothing shared), so several friends can each hold an identical one.
export function recipeContentKey(r) {
  const names = [...new Set((r.ingredients || []).map((i) => norm(i.name)).filter(Boolean))].sort()
  return `${norm(r.title)}|${names.join(',')}`
}

export function dedupeRecipes(recipes) {
  const seen = new Set()
  return recipes.filter((r) => {
    const k = recipeContentKey(r)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}
