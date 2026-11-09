# Duplicate friend requests not consolidated

## His words (verbatim)

> "We shouldn't be getting duplicate friend invites they shouldn't double up they should
> be consolidated. For notifications and requests"

Photo attached: Social tab, Requests section, showing TWO identical pending-request rows
for "Stephanie C Stronks Knapp" (same name, same Accept/Decline pair), and the Social tab
nav icon badge shows "2" (counting both as separate).

## Likely root cause (starting point, confirm before trusting)

`src/lib/firestore.js`:
- `sendFriendRequest` (line ~199) does a bare `addDoc` into `friendRequests` with **no
  check for an existing pending request** between the same two users (either direction)
  before creating a new one.
- `acceptInvite`'s no-token branch (~line 274-280) DOES check for an existing pending
  request before sending -- but only in one direction (`fromUserId==me && toUserId==
  inviterId`), not the reverse, and not for the already-accepted-with-token branch
  (~282-291) which has no dedup check at all.
- `src/pages/Friends.jsx` `addFriend()` (~line 82-85) calls `fs.sendFriendRequest` with no
  guard against a double-tap (no disabling the button while the call is in flight) and no
  check whether a request already exists in either direction before sending.
- A second call site at `Friends.jsx` ~line 576 also calls `fs.sendFriendRequest` directly.

Confirm the actual mechanism (don't assume) before fixing -- check live Firestore
`friendRequests` for Stephanie's two docs (createdAt timestamps close together? same
exact fields? which call path produced each one) via the admin broker
(`scripts/broker/firebase-api`), not just guessing from the code.

## Fix

1. Prevent future duplicates: before creating a new `friendRequests` doc (every path --
   `sendFriendRequest`, both `acceptInvite` branches), check for any existing pending OR
   accepted request between the same two users in EITHER direction, and no-op (or
   short-circuit to the existing outcome) instead of creating a second doc.
2. Guard the UI against a double-tap causing two rapid calls (disable the Add/Accept
   button while its own request is in flight) as defense in depth, not as the only fix --
   the server-side-equivalent dedup check above is the real fix since two different
   entry points (search-add, invite link) can each independently create one.
3. **Consolidate existing duplicates in the live database** (not just new ones going
   forward) -- he said "shouldn't double up" about what he's looking at right now, which
   is already-duplicated data: find every (fromUserId, toUserId, status) group in
   `friendRequests` with more than one doc, keep one (oldest `createdAt`), delete the
   rest. Do this for real against the live Firestore via the admin broker, not just in
   code that would only prevent new ones.

## Not doing

- No change to the request UI style/layout -- this is strictly about duplicates, not
  how a request row looks.

## Done when

- Live Firestore `friendRequests` has at most one doc per (fromUserId, toUserId) pair
  in pending/accepted state -- confirm by actually querying it after the cleanup runs,
  not just by code review.
- The Social tab's Requests section for the real affected accounts now shows exactly one
  row for Stephanie, and the nav badge count matches the real number of distinct pending
  requests.
- Repro: send a request from the same account to the same target twice in a row (two
  taps, or the search-add flow run twice) -- confirm only one `friendRequests` doc
  results.
- Repro: open the same invite link twice -- confirm only one doc results, not two.
- `npm run build` clean, `node scripts/check-jsx-imports.mjs` passes, `npm test` green.

## Tries

5

## Result (2026-11-09, v1.39.1, committed locally, NOT pushed; no rules change)

- Mechanism (live data): Stephanie's two pending docs to Jat were 2m32s apart (03:36:03,
  03:38:35 UTC), identical fields, no inviteToken. Not a double tap and not the invite
  link (the no-token link path already checked one direction). The top search list's Add
  button never switched to Requested, so a second Add later sent a second doc. Same shape
  for Dad -> Mo (Oct 19 + Nov 7).
- Live cleanup: backed up all 28 friendRequests docs to
  artifacts/pantry-friendRequests-backup-20261109.json, then deleted the 5 newer
  duplicates per (from, to, status): WdsWb9905PGEfOpV1meZ (Stephanie->Jat pending),
  vYZY9kVgzE3e2ABdkW5f (Dad->Mo pending), 4Lu64PxDVRpzvXcVbDcw (Dad->Debbie accepted),
  lvzXQUck0CCDh2WZssVB, ffAswuab3XZvRNTYqQk4 (declined dups). Re-query: 23 docs, zero
  pairs with >1 pending/accepted; Jat has exactly one pending (Stephanie).
- Code: every send path checks both directions first (accepted -> already friends; they
  asked me -> accept theirs; I asked -> no-op), and new requests use a fixed doc id
  `${from}_${to}` so even two concurrent calls collapse to one (the rules refuse the
  sender an update). Incoming list deduped per sender (fixes the badge for old data);
  Accept/Decline answers every duplicate doc. Search shows Requested; Add/Accept/Decline
  disabled while in flight.
- Verified: npm test 45/45, check-jsx-imports, npm run build clean,
  tests/emulator/friend-requests.sh all 9 scenarios pass against the real rules.
