# Friends search: live-update as you type, remove Search button

## His words

> "When you are searching for a friend have it live update as you search the letters so
> you don't have to wait to press search. Matter of fact when you fix that remove the
> search button"

(Telegram/JatBot, Pantry room, 2026-10-22 9:29:48 PM MDT, msg 522. Screenshot attached:
Friends page, search box with "Hann" typed, orange "Search" button still next to it,
results not yet shown because Search hadn't been tapped.)

## Goal

Friends search (`src/pages/Friends.jsx`) updates results as he types, with no button to
press. The Search button goes away once that works.

## Done when

- Typing in the Friends search box shows matching users without tapping anything —
  results update a short beat (debounce, ~300ms) after the last keystroke, not on every
  single keystroke synchronously.
- The Search button is gone from the page. No dead code left behind (`doSearch`, the
  `onKeyDown` Enter handler tied to it) if it's no longer reachable.
- Clearing the box back to empty clears the results list (doesn't leave the last search's
  results on screen).
- Typing a partial prefix of a real display name (e.g. "Hann" for "Hannah") returns that
  user. **Check `fs.searchUsers` in `src/lib/firestore.js` first** — the range query's
  upper bound (`const end = t + ''`) is currently identical to the lower bound, which
  Firestore reads as an exact-match query, not a prefix query. That bug has to be fixed
  for live-as-you-type search to show anything useful before the full name is typed;
  it's in scope as part of making this feature work, not a separate task. Standard fix is
  `t + ''` as the upper bound.
- Typing fast (a full name in under a second) does not fire a flood of overlapping
  Firestore reads — debounce + ignoring a stale response that resolves after a newer
  keystroke already changed the term.
- `npm run build` succeeds, `node scripts/check-jsx-imports.mjs` passes (VERIFY.md).

## Reference

none (behavior change, not a visual redesign).

## Not doing

- No change to the invite/share row, the Friends list below, or the friend-request
  section.
- No fuzzy/typo-tolerant search — same prefix-match semantics as today, just applied
  live and actually working for partial names.
- No loading spinner redesign — reuse the existing `ListSkeleton` while a search is in
  flight.

## Tries

5

## Open questions

None — instruction is fully specific, starting without waiting on a tap-back.

## Result (2026-10-22)

Built as v1.35.0, committed locally on main, **not pushed** (prod push waits for his go).
Verified with a headless harness against the local dev server at 390px
(`/home/roni/agent/artifacts/pantry-friends-search/live-search.mjs`, output in
`output.txt` next to it). The harness fakes a signed-in user and swaps only the final
`getDocs` call for an in-memory filter over six fixture users, using the exact `t`/`end`
bounds `searchUsers` computes, with 400ms fake latency. Real Firestore was not reachable:
an unauthenticated read of `users` returns 403 PERMISSION_DENIED, and guest mode has no
uid, so nothing here is proven against his real user list.

- **Live results, debounced: PASS.** Typing "Hannah" at 60ms per key fired 1 lookup
  (~300ms after the last key) and showed "Hannah Berry" with nothing tapped. "Ha", pause,
  "nn", pause fired exactly 2 lookups ("ha", "hann"). Screenshots `3-hannah.png`,
  `5-hann.png`.
- **Search button gone, no dead code: PASS.** 0 buttons labelled Search on the page;
  `doSearch` and the `onKeyDown` Enter handler deleted (not hidden). Pressing Enter does
  nothing new and throws nothing. The input now sits alone, full width (358 of 358px),
  `1-empty.png`.
- **Clearing empties results: PASS.** After clearing: 0 result cards and no "No users
  found." message. Whitespace-only input fired 0 lookups. `4-cleared.png`.
- **Partial prefix returns the user: PASS, but the card's premise was wrong.** The old
  code was already `t + ''`: `od -c` on HEAD shows bytes `357 243 277` (U+F8FF)
  between the quotes. It looked like `t + ''` only because that character is invisible
  in most editors and terminals. So prefix search already worked once he tapped Search;
  his screenshot showed no results because Search hadn't been tapped yet, not because
  of a range bug. Changed it to the written-out escape `''` with a comment so it
  can't be misread again. The query behavior is identical. Harness: "Ha" returns 4
  users, "Hann" returns only Hannah Berry. `searchUsers` is the only prefix-range query
  in `firestore.js`.
- **No query flood, stale responses dropped: PASS.** 6 fast keystrokes made 1 read.
  Stale test: typed "hank", waited 350ms (its lookup was in flight), changed to "zz".
  The late "hank" answer was ignored; the screen showed "zz"'s empty result and "No
  users found.", not Hank.
- **Build checks: PASS.** `npm run build` OK, `node scripts/check-jsx-imports.mjs` exit
  0, `npm test` 28/28. No page errors in the harness.

One behavior call made: the skeleton only shows until the first results arrive. After
that, the previous list stays on screen while the next lookup runs, so the list doesn't
blink on every pause in typing.
