// Pure friend-request rules, kept free of Firebase so node:test can cover them.

// One request doc per sender->recipient pair. New requests use this id, so a second
// send (double tap, two devices, search-add after an invite link) lands on the same doc:
// the rules refuse the sender an update, and nothing doubles up.
export function requestDocId(fromUserId, toUserId) {
  return `${fromUserId}_${toUserId}`
}

function millis(t) {
  if (!t) return Infinity // a just-written serverTimestamp reads null until it lands
  if (typeof t.toMillis === 'function') return t.toMillis()
  if (t instanceof Date) return t.getTime()
  return Number(t) || Infinity
}

// Incoming pending requests, one row per sender (the oldest doc), carrying every doc id
// from that sender so answering the row answers all of them. Older data has duplicates.
export function dedupeIncoming(requests) {
  const bySender = new Map()
  for (const r of [...requests].sort((a, b) => millis(a.createdAt) - millis(b.createdAt))) {
    const row = bySender.get(r.fromUserId)
    if (row) row.ids.push(r.id)
    else bySender.set(r.fromUserId, { ...r, ids: [r.id] })
  }
  return [...bySender.values()]
}

// What sending a request to someone should do, given the request docs already between
// us: mine = docs from me to them, theirs = docs from them to me.
//   'friends' - an accepted request exists either way: nothing to send
//   'accept'  - they already asked me: accepting theirs is the answer
//   'pending' - I already asked them: nothing to send
//   'send'    - nothing live between us (declined ones don't count)
export function planFriendRequest(mine, theirs) {
  const has = (list, status) => list.some((r) => r.status === status)
  if (has(mine, 'accepted') || has(theirs, 'accepted')) return 'friends'
  if (has(theirs, 'pending')) return 'accept'
  if (has(mine, 'pending')) return 'pending'
  return 'send'
}
