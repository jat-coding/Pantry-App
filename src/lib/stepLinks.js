// Manual step-to-ingredient links: `stepIngredientLinks` on a recipe, an object of
// step index -> array of ingredient indexes ({ '1': [0, 2] }). A step with an entry
// shows exactly those ingredients in Cook Mode (an empty array means "none"); a step
// with no entry falls back to text-matching (stepIngredients.js).
//
// Both keys and values are array positions, so every operation that removes or
// reorders steps or ingredients has to re-point them. All helpers here are pure and
// return a new object.

// Drop anything malformed or out of range; dedupe and sort each list.
export function cleanStepLinks(raw, stepCount, ingredientCount) {
  const out = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [key, list] of Object.entries(raw)) {
    const s = Number(key)
    if (!Number.isInteger(s) || s < 0 || s >= stepCount || String(s) !== key) continue
    if (!Array.isArray(list)) continue
    const ids = list.filter((k) => Number.isInteger(k) && k >= 0 && k < ingredientCount)
    out[s] = [...new Set(ids)].sort((a, b) => a - b)
  }
  return out
}

// Re-point links through old-index -> new-index maps (an array; -1 = dropped).
export function remapStepLinks(links, stepMap, ingredientMap) {
  const out = {}
  for (const [key, list] of Object.entries(links || {})) {
    const s = stepMap[Number(key)]
    if (s == null || s < 0) continue
    const ids = (list || []).map((k) => ingredientMap[k]).filter((k) => k != null && k >= 0)
    out[s] = [...new Set(ids)].sort((a, b) => a - b)
  }
  return out
}

// Old-index -> new-index map for keeping only the items `keep` says yes to.
export function keepMap(items, keep) {
  let next = 0
  return items.map((item) => (keep(item) ? next++ : -1))
}

export function linksAfterRemoveIngredient(links, i) {
  const out = {}
  for (const [key, list] of Object.entries(links || {})) {
    out[key] = list.filter((k) => k !== i).map((k) => (k > i ? k - 1 : k))
  }
  return out
}

export function linksAfterRemoveStep(links, i) {
  const out = {}
  for (const [key, list] of Object.entries(links || {})) {
    const s = Number(key)
    if (s === i) continue
    out[s > i ? s - 1 : s] = list
  }
  return out
}

export function linksAfterSwapSteps(links, i, j) {
  const out = { ...(links || {}) }
  const a = out[i]
  const b = out[j]
  delete out[i]
  delete out[j]
  if (b) out[i] = b
  if (a) out[j] = a
  return out
}

// Toggle ingredient `k` for step `s`. `current` is what the step shows right now
// (its explicit list, or the text-matched one when it has none), so the first tap
// on an auto-matched step keeps the rest of what was already showing.
export function toggleStepLink(links, s, k, current) {
  const has = current.includes(k)
  const next = has ? current.filter((x) => x !== k) : [...current, k].sort((a, b) => a - b)
  return { ...(links || {}), [s]: next }
}

export function clearStepLink(links, s) {
  const out = { ...(links || {}) }
  delete out[s]
  return out
}

// The explicit ingredient list for step `s`, or null when it has none (fall back).
export function explicitStepLink(links, s) {
  const list = links && typeof links === 'object' ? links[s] : undefined
  return Array.isArray(list) ? list : null
}
