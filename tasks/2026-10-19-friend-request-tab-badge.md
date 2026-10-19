# Friend-request badge on the Friends tab

## Goal

Show a notification badge on the Friends nav tab when there's at least one incoming,
unanswered friend request, so he doesn't have to open Friends to find out.

## Done when

1. Incoming-request count (`fs.listenIncomingRequests`, currently wired only inside
   `src/pages/Friends.jsx`) is available wherever `Layout.jsx` renders — lift it into
   `DataContext` (a live count, not a one-time fetch) rather than duplicating the
   listener in Layout.
2. `src/components/Layout.jsx` shows a small badge (dot or count, your call — small
   count bubble if 1-9, "9+" beyond that) on the Friends tab icon in both the mobile
   bottom bar and the desktop sidebar, only when the count is > 0. No badge when 0.
3. Friends.jsx still works exactly as before (request list, accept/decline) — this is
   additive, don't change how requests are fetched/answered, just where the count is
   also read from.
4. Badge updates live without a page reload (new request arrives while the app is
   open -> badge appears; accept/decline the last one -> badge disappears).
5. `npm run build` succeeds, no new console errors/warnings.
6. APP_VERSION bumped + dated CHANGELOG entry, user-facing language.

## Not doing

- Not building push notifications / OS-level alerts — in-app tab badge only.
- Not changing the request accept/decline flow itself.

## Tries

5

## Open questions

None blocking.
</content>

## Result — 2026-10-19 (v1.28.0, local commit only, not pushed)

Built in 2 build-and-check tries (try 1: 24/28, the desktop sidebar badge sat at the far
right of the Friends row instead of on the icon; moved it onto the icon. Try 2: 28/28).
Harness: REAL `Layout` + REAL `DataProvider` + REAL `Friends` page, with only AuthContext
and `lib/firestore.js` stubbed (the stub's `listenIncomingRequests` behaves like the real
onSnapshot query: pushes the pending list on subscribe and on every change, and
`respondToRequest` flips status then re-emits). 390x844 + 1280x800, Chromium + WebKit,
28/28 each. Evidence: `/home/roni/agent/artifacts/pantry-reqbadge-2026-10-19/` (run.mjs,
harness/, screenshots, chromium-results.json, webkit-results.json). Not click-tested
against live Firebase (no keys on this machine).

- [x] 1 Count in DataContext — PASS. `DataContext` subscribes to
  `fs.listenIncomingRequests` (live, unsubscribes on sign-out/guest) and exposes
  `incomingRequestCount`. Layout reads it from `useData()`, no listener of its own: on
  Grocery exactly 1 live listener; on Friends 2 (DataContext + the page's existing one);
  back to 1 after leaving Friends (no leak). Guest: 0 listeners, no badge.
- [x] 2 Badge — PASS. Count bubble on the Friends icon, mobile bottom bar and desktop
  sidebar: n=0 none in either; n=1 "1", n=9 "9", n=10 "9+", n=23 "9+", each exactly one
  badge, on the Friends link, overlapping its icon, on screen. Still visible on the
  active (pill-highlighted) Friends tab. aria-label "N friend request(s)".
- [x] 3 Friends unchanged — PASS. `git diff src/pages/Friends.jsx` is empty. In the
  harness the page lists both requests, Decline calls `respondToRequest(req, false, 'me')`
  and removes the row with the "Request declined" toast, Accept calls it with `true`,
  shows "You and Alex are now friends", and the Requests section disappears.
- [x] 4 Live — PASS. 0 -> request arrives -> "1" -> second -> "2" -> decline one -> "1"
  -> accept last -> gone -> new one on another tab -> "1", with zero page navigations
  across the flow. Desktop sidebar 0 -> 12 ("9+") -> 0 live too.
- [x] 5 Build — PASS. `npm run build` exit 0, no warnings/errors in its output; zero
  console errors/warnings/page errors across all harness runs (React Router future-flag
  notices excluded, pre-existing).
- [x] 6 Version — PASS. APP_VERSION 1.27.0 -> 1.28.0, dated 2026-10-19 CHANGELOG entry;
  "1.28.0" present in the built bundle.
