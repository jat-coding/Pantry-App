// Last-known friend list, kept on the device so the Friends tab paints names and
// avatars on the first frame instead of after a round trip to Firestore. The live
// fetch still runs every time and overwrites this — the cache only decides what
// you look at during the ~1s it takes.

const KEY = (uid) => `pantry.friends.${uid}`

export function readFriendCache(uid) {
  if (!uid) return null
  try {
    const raw = localStorage.getItem(KEY(uid))
    const list = raw ? JSON.parse(raw) : null
    return Array.isArray(list) ? list : null
  } catch {
    return null
  }
}

export function writeFriendCache(uid, list) {
  if (!uid) return
  try {
    // Only the fields the list row renders — no point storing whole profiles.
    const slim = list.map(({ id, displayName, avatarUrl, bio }) => ({ id, displayName, avatarUrl, bio }))
    localStorage.setItem(KEY(uid), JSON.stringify(slim))
  } catch {
    /* quota or private mode — the tab just loses its head start */
  }
}
