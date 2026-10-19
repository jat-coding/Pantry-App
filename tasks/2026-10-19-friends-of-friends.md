# Friends: show a friend's own friends, let him add them

## Goal

Opening a friend's pantry (`/friends?friend=<id>`) also shows who THAT person is
friends with, and lets him send a friend request to any of them directly from there.

## Security note (checked before writing this card)

No Firestore rules change needed. `friendIds` lives as a plain field on the public
`users/{userId}` doc, and the existing rule is `allow read: if signedIn()` — any
signed-in user can already read any user's `friendIds` (it's not gated like private
recipes are). `src/lib/firestore.js` already has `getUsersByIds(ids)` (used elsewhere to
resolve a friend list to profiles) — reuse it for the viewed friend's friend list too,
don't add new rules or a new resolver.

## Done when

1. On the friend-pantry view (`src/pages/Friends.jsx`, the `viewing` branch), a new
   section lists that friend's own friends (name + avatar/initial, same visual
   language as the existing friends list), fetched via `fs.getUsersByIds(viewedFriend
   .friendIds)`.
2. Each person in that list who is NOT already one of his own friends and has no
   pending request either way gets an "Add" action, wired to the existing
   `fs.sendFriendRequest` (same as the regular search-and-add flow) — no new request
   data model.
3. Someone already his friend shows as such (no duplicate "Add" button, e.g. a
   "Friends" label or simply omitted/disabled) — never let a double request go out.
4. Himself, if he appears in that list (viewing a mutual friend who lists him back),
   is excluded or shown distinctly — never an "Add yourself" button.
5. Empty case: the viewed friend has zero friends of their own — section doesn't
   render, or shows a plain "No friends yet" line, not a blank gap or error.
6. `npm run build` succeeds, no new console errors/warnings.
7. APP_VERSION bumped + dated CHANGELOG entry, user-facing language.
8. Regression: the existing friend-pantry view (their recipes, pocket-to-my-pantry)
   is unchanged; the Friends tab's own request list/badge (just shipped) is unaffected.

## Not doing

- Not building any "send a recipe to them" push mechanism — he dropped that ask.
- Not changing the Firestore rules — confirmed unnecessary, see note above. If the
  build turns up a reason rules DO need to change, stop and flag it rather than
  deploying a rules change unasked.

## Tries

5

## Open questions

None blocking.
</content>

## Result — 2026-10-19 (v1.29.0, local commit only, not pushed)

Built in 1 try (one harness selector fix, not an app fix). firestore.rules untouched.
Harness: REAL `Layout` + REAL `DataProvider` + REAL `Friends` page, only AuthContext and
`lib/firestore.js` stubbed. Mock graph: me friends with Alex, Sam, Zed. Alex's list = me,
Sam (already mine), Pat (I have a pending request out), Quinn (new, has a photo), Riley
(sent ME a pending request), Ghost (stale, doesn't list Alex back). Zed lists only me.
390x844 + 1280x800, Chromium + WebKit, 39/39 each. Evidence:
`/home/roni/agent/artifacts/pantry-fof-2026-10-19/` (run.mjs, harness/, screenshots,
chromium-results.json, webkit-results.json). Not click-tested against live Firebase.

- [x] 1 Section — PASS. "Alex's Friends" renders below "Alex's Pantry", rows = card +
  avatar/initial + name (same markup as My Friends). Fetched by
  `fs.getUsersByIds(alex.friendIds minus me)`, call log confirms. Only mutual entries are
  shown (same rule as his own list), so stale Ghost is left out. No row overflows at 390.
- [x] 2 Add — PASS. Quinn shows Add; tapping it 3x sends exactly one
  `sendFriendRequest(me, 'quinn')`, toast "Friend request sent", row flips to
  "Requested". Pat (pending out) shows "Requested", no button. Riley (pending in) shows
  Accept (existing `respondToRequest`), never Add; after Accept the row shows Friends
  with no Add flash. Outgoing pending comes from a new read-only listener
  `listenOutgoingRequests` (fromUserId == me, status == pending; same query shape as the
  existing `listenAcceptedSent`, already allowed by the rules). Failed send: "Could not
  send request" toast and Add comes back.
- [x] 3 Already friends — PASS. Sam shows "Friends" with a check, no button.
- [x] 4 Himself — PASS. Me is dropped before fetching; no row for Jack.
- [x] 5 Empty — PASS. Zed: "No other friends yet." line under "Zed's Friends".
- [x] 6 Build — PASS. `npm run build` exit 0, no warnings/errors; zero console
  errors/warnings/page errors in all harness runs (React Router future-flag notices
  excluded, pre-existing).
- [x] 7 Version — PASS. 1.28.0 -> 1.29.0, dated CHANGELOG entry; "1.29.0" in the bundle.
- [x] 8 Regression — PASS. Header, bio, Remove, Alex's Pantry + recipe unchanged; Copy to
  Pantry still pockets ("Copied to your Pantry"). Back closes it and the outgoing listener
  unsubscribes. Friends tab still shows Requests (Riley) and the "1" badge.
