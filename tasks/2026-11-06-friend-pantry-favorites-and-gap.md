# Friend's pantry: favorites filter + bottom-gap fix

## His words

> [JatBot, 11/6, msg 582] "Let people see their friends recipes in a list view also let
> them see the categories of food." (original ask that spun off these two follow-ups)

> [JatBot, 11/6 6:54pm, answering this agent's questions]
> "Favorites on a friend's pantry — what should "favorite" mean there? → Favorite means
> whatever the users favorited recipes are. So you can have a curated list"
> "Where's the bottom gap — which screen? → A friend's pantry (the screen in your photo)"

## Goal

On a friend's pantry screen: let him filter to just that friend's own favorited recipes
(a curated list), and fix the gap at the bottom of that screen.

## Context that matters

- In this codebase "favorite" = pantryIds membership (`firestore.js` comment "Pantry
  (favorites)"). `getFriendRecipes(authorId)` currently returns ALL of a friend's
  authored recipes — not filtered by that friend's own pantryIds. His answer means the
  curated list = the friend's authored recipes that are ALSO in THAT FRIEND's own
  pantryIds (their favorites), not the viewer's pantryIds. Need to read the friend's
  pantryIds (check for an existing user-doc getter before adding a new Firestore read).
- Bottom-gap screen confirmed as the friend's pantry (`FriendProfile` in
  `src/pages/Friends.jsx`). Exact visual shape of the gap wasn't described in text (he
  sent a photo) — diagnose by screenshotting the real overlay at 390px, grid and list
  view, and check whether it was introduced by the 11/6 list/categories build
  (`9487132`) before assuming pre-existing.

## Done when

- Friend's pantry has an All/Favorites filter; selecting Favorites shows only recipes
  that are in that friend's own pantryIds, same categorized-sections layout as All.
- Filter follows the app's existing toggle visual style (same family as `ViewToggle`),
  not a new one-off control.
- No gap at the bottom of the friend's pantry screen in either grid or list view, at
  390px width — screenshotted before/after.
- `npm run build`, `node scripts/check-jsx-imports.mjs`, `npm test` all pass clean.
- Grid view and "Copy to Pantry" in both views unchanged (no regression on the
  11/6 list/categories work).

## Reference

none (no image/URL/style given beyond his photo, which only located the bug — not a
visual bar to match).

## Not doing

- Touching My Pantry (`src/pages/Pantry.jsx`) itself.
- Any other friends-list or friend-request UI.

## Tries

5

## Open questions

none — scope is derived directly from his two answers above; remaining details (exact
toggle copy/placement, root cause of the gap) are implementation, not scope, decisions.

## Result — 2026-11-06 (v1.37.0, local commit on main, not pushed)

Built on try 1 of 5 (harness itself needed 3 runs for selector/Chromium issues, the
app code passed every check the first time it was actually exercised).

**Favorites filter.** New `FavoritesToggle` (All / Favorites) in
`src/components/RecipeViews.jsx`, sharing one `TOGGLE_SHELL` + `segment()` style with
`ViewToggle` (ViewToggle's rendered classes are unchanged, just sourced from the shared
helper). In `FriendProfile`, a `visible` memo filters the friend's recipes to the ones
in **the friend's own** `friend.pantryIds`; `sections` now groups `visible`, so
Favorites uses the exact same category-section layout. `pantryIds` is already on the
friend's user doc DataContext loads via `getUsersByIds` (full doc), so no new Firestore
read. Layout: "<Name>'s Pantry" heading on its own line, then one row with
All/Favorites left and grid/list right (both toggles wouldn't fit beside the heading at
390px). Empty favorites shows "<Name> hasn't favorited any of their recipes yet."

**Bottom gap.** Root cause, from his own photo (`bridge/run/photos/jatbot--1004427257155_0-1794006792958-IMG_1029.png`,
1179x2556): the overlay's scroll area stops ~59pt above the screen bottom, card cut
mid-image, bare cream strip below. That is the iOS 26.1 home-screen-app bug (WebKit
301994) `src/lib/useStandaloneBottomGap.js` already documents and that PdfPreview
already fixes. The friend overlay never got the fix. **Pre-existing, not introduced by
9487132**: the `fixed inset-0` overlay line dates to v1.10.2 (`git log -L`). Fixed the
same way as PdfPreview: `style={{ bottom: -bottomGap }}` on the overlay.

Checks (harness: `/home/roni/agent/artifacts/pantry-friend-favorites-20261106/check.mjs`,
output `run.txt` there):
- [x] All/Favorites filter, Favorites = friend's own pantryIds, same sections — fixture
  friend pantryIds `r1,r3,r5,r7,someone-elses`, viewer pantryIds deliberately different
  (`r2,r4`). All = 7 recipes / 4 sections; Favorites = exactly the 4 expected titles in
  Breakfast1/Dinner1/Dessert1/Drinks1, in grid AND list; r2/r4 absent (proves it reads
  the friend's list, not the viewer's); non-own id ignored.
- [x] Same toggle family as ViewToggle — both toggles' wrappers have the identical class
  string (checked in-page, 1 unique shell across 4 buttons); screenshot.
- [x] No bottom gap, grid + list, 390px — emulated iOS standalone (viewport 785, screen
  844, `navigator.standalone=true`): before-fix (fix line stripped via route patch)
  overlay bottom 785 = 59px strip in both views; after-fix overlay bottom 844 = 0px,
  `style.bottom=-59px`, both views. Visual before/after at 844px:
  `gap-before-390-grid.png`, `gap-before-390-list.png` (bug geometry simulated by pinning
  the overlay 59px up), `gap-after-390-grid.png`, `gap-after-390-list.png` (real code).
  Not verified on a real iPhone: headless Chromium can't reproduce the WebKit bug itself,
  only its geometry and the hook's response to it.
- [x] Build/lint/test — `npm run build` clean, no warnings; `node
  scripts/check-jsx-imports.mjs` "checked 30 file(s)... every JSX component tag is
  imported or defined"; `npm test` 28/28 pass, 0 fail (no new unit coverage, per
  VERIFY.md).
- [x] No regression on 11/6 list/categories — grid still RecipeCard with pills; list rows
  0 `.pill-peach`; Copy to Pantry: grid click called `pocketRecipe('r1')`, list click
  called `pocketRecipe('r3')`, both stayed on `/friends?friend=u-hannah`; default
  All+Grid from `localStorage['pantry-view']`; 0 console/page errors.

Screenshots: `/home/roni/agent/artifacts/pantry-friend-favorites-20261106/`
`390-grid-all.png`, `390-grid-favorites.png`, `390-list-all.png`,
`390-list-favorites.png`, plus the four `gap-*` files above.

**Not doing, respected**: Pantry.jsx untouched (ViewToggle there renders identically via
the shared helper); no other friends UI touched; the heart-reflects-your-pantry quirk on
friend cards left as-is (pre-existing, out of scope).

**Not pushed** — prod push needs his go-ahead.
