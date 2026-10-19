// The Cook tab opens straight into Cook Mode for whatever he was just cooking:
// the last recipe opened, else the last one hearted. Same localStorage pattern as
// Pantry.jsx's VIEW_KEY / ONBOARDED_KEY.
export const LAST_OPENED_KEY = 'pantry-last-opened'

export function recordOpened(id) {
  try { localStorage.setItem(LAST_OPENED_KEY, id) } catch { /* private mode / full */ }
}

export function lastOpened() {
  try { return localStorage.getItem(LAST_OPENED_KEY) } catch { return null }
}

// Newest heart that's still one of his recipes. arrayUnion appends, so the end of
// pantryIds is the most recent like.
export function lastLiked(recipes, pantryIds) {
  const mine = new Set(recipes.map((r) => r.id))
  for (let i = pantryIds.length - 1; i >= 0; i--) if (mine.has(pantryIds[i])) return pantryIds[i]
  return null
}
