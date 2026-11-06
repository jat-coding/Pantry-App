# Friend's pantry: list view + category sections, matching My Pantry

## His words

> [JatBot, 11/6, msg 582] "Let people see their friends recipes in a list view also let
> them see the categories of food." (plus a separate favorites-sort ask and a bottom-gap
> bug, both split into their own follow-up — see Not doing.)

## Goal

Bring the friend-pantry view (`FriendProfile` in `src/pages/Friends.jsx`, opened via
"View Pantry") up to the same browsing experience `src/pages/Pantry.jsx` ("My Pantry")
already has: a grid/list view toggle, and recipes grouped into category sections —
instead of today's single flat responsive grid with no toggle and no grouping.

## Context that matters

- `Pantry.jsx` already has every piece needed: `ViewToggle` (grid/list, persisted to
  `localStorage` under `pantry-view`), `RecipeListView` (compact list rows), and the
  `sections` memo that buckets `recipes` into one section per `CATEGORIES` entry (plus
  `OTHER`), each with a "See all" overflow past `PREVIEW_COUNT` (4). None of these three
  are currently exported — only `Pantry.jsx` uses them. Move `ViewToggle` and
  `RecipeListView` into their own file (e.g. `src/components/RecipeViews.jsx`) so both
  pages import the same components rather than forking a second copy. The
  category-sectioning logic (the `sections` useMemo + the `<section>` render block) can
  stay duplicated-but-adapted in `Friends.jsx` if extracting it cleanly is awkward, but
  prefer a shared hook/helper if it's not much more work.
- **Do NOT put category pills back into list-view rows.** FEEDBACK.md 2026-10-21: he
  explicitly had the `pill-peach` category chips *removed* from `RecipeListView` because
  they ate the row width and clipped long titles ("Maple Sea Salt..." → "Maple" / "Sea
  Salt..."). List view must stay pill-free — category info belongs in the section
  headers (`CategoryIcon` + category name, as `Pantry.jsx` already does), not inline per
  row. Grid view's `RecipeCard` already shows pills per card — leave that as-is, it's
  unrelated and not what he flagged.
- A friend's pantry currently has no "liked-first" concept — don't invent one.
  Each section just lists that friend's recipes in that category, in whatever order
  `getFriendRecipes` already returns them (no re-sort here). A separate favorites-sort
  ask is being scoped with him directly and will land as its own task — don't guess at
  it in this one.
- `FriendProfile` is a portaled full-screen overlay (`fixed inset-0`), not a route — the
  toggle's localStorage key should NOT be the same `pantry-view` key `Pantry.jsx` uses if
  you want them independent; reuse the same key if you want one global preference instead
  (pick reuse — simpler, and "grid vs list" is a personal viewing preference, not
  per-screen). Use the same key (`pantry-view`).
- `getCategories`/`primaryCategory`/`CATEGORIES` all live in `src/lib/categories.js` —
  reuse them, don't reimplement.
- Empty-section and empty-overall states: `FriendProfile` currently shows "No recipes to
  show yet." when `recipes.length === 0`. Keep that top-level empty state; sections
  themselves only render when non-empty, same as `Pantry.jsx`.

## Done when

- Opening a friend's pantry shows a grid/list `ViewToggle` (same visual component as My
  Pantry) above the recipe list, defaulting to whatever `localStorage['pantry-view']` is
  already set to.
- Recipes are grouped into category sections (header = `CategoryIcon` + category name +
  count), same ordering as `CATEGORIES` + `OTHER`, same "See all" overflow past 4 per
  section.
- List view shows **no category pills** on rows — confirmed by code inspection of the
  shared `RecipeListView` component (not a second copy).
- Grid view is visually unchanged from today (still `RecipeCard`, still shows pills on
  cards) other than now being grouped into sections instead of one flat grid.
- "Copy to Pantry" (the `showPocket` button) still works unchanged in both views.
- `npm run build` and `node scripts/check-jsx-imports.mjs` pass clean.
- `npm test` passes (confirms nothing else broke).
- Visual check on a real friend profile with recipes across at least 2 categories, at
  both 390px width and desktop width, screenshotted for both grid and list view.

## Reference

`src/pages/Pantry.jsx` (ViewToggle, RecipeListView, sections memo) is the reference
implementation — match its look and behavior exactly, just scoped to one friend's
recipes instead of `recipes`/`pantryIds`.

## Not doing

- Favorites-first sort for a friend's recipes — ambiguous (no favorite flag exists on
  recipes; "liked" in My Pantry means YOUR pantryIds, which don't meaningfully map onto
  a friend's own recipe ids). Being clarified with him directly as a separate task.
- The reported bottom-of-screen gap bug — location not yet confirmed with him. Separate
  task once he says which screen.
- Fixing the heart icon's pantryIds-matching quirk on friend cards (pre-existing,
  unrelated to this ask).
- Touching `Pantry.jsx` itself beyond extracting `ViewToggle`/`RecipeListView` into a
  shared file (import, don't rewrite its logic).

## Open questions

none — scope is derived directly from the existing, proven `Pantry.jsx` pattern.

## Result — 2026-11-06 (v1.36.0, local commit `9487132`, not pushed)

Built on try 1 of 5. `ViewToggle` and `RecipeListView` moved into
`src/components/RecipeViews.jsx` (new file, exported, `VIEW_KEY = 'pantry-view'`
also exported from there so both pages read/write the identical key — checked by
setting the key before load and confirming the friend profile opens already in
list view). `Pantry.jsx` now imports both from the shared file; its own logic
(sections, sort, filters) untouched beyond the extraction. `FriendProfile` in
`Friends.jsx` gained its own `view`/`expanded` state and a `sections` useMemo that
groups the friend's recipes into `CATEGORIES` + `Other`, same order and same
"See all" overflow past 4 as `Pantry.jsx`.

One gap found during the build's own fresh-context re-read of "Done when" against
the card, not sent back from outside: the card requires "Copy to Pantry... still
works unchanged in both views," but `RecipeListView` as extracted had no pocket
affordance at all (`RecipeDetail` has no pocket action either, so list view would
have silently been the one path with no way to copy a friend's recipe). Fixed by
giving `RecipeListView` an optional `showPocket`/`onPocket`/`pocketLabel` prop
(off by default, so `Pantry.jsx`'s own list view is pixel-identical to before —
confirmed by screenshot, see below); `Friends.jsx` passes it, My Pantry's call
site doesn't.

Checks, each with how it was actually confirmed:
- [x] **No category pills anywhere in list-view rows** — confirmed two ways, not
  just by eye: (1) read `RecipeViews.jsx`'s `RecipeListView` in full, no
  `pill-peach` class or category text anywhere in the row markup; (2) a headless
  Chromium run counted `.pill-peach` elements inside `ul.divide-y li` after
  switching to list view on a real friend profile — **0**, vs. **5** on the same
  data in grid view (one pill per card, expected and unchanged).
- [x] **Build/test/lint all pass clean, real output shown** — `npm run build`:
  clean Vite build, no new warnings (ran twice, before and after the pocket-button
  fix). `node scripts/check-jsx-imports.mjs`: `checked 30 file(s) under src/ --
  every JSX component tag is imported or defined` (29 before the new file existed,
  30 after — the new file is now part of what's checked). `npm test`: `28/28
  pass`, `0 fail` (same 28 as before this change — nothing here has its own test
  coverage yet, per VERIFY.md, so these are the pre-existing scaling/stepLinks/
  jsx-import tests confirming nothing broke, not new coverage for this feature).
- [x] ViewToggle + category sections render on a friend's pantry, defaulting to
  whatever `localStorage['pantry-view']` already held — verified by setting the
  key to `'list'` before load and confirming the toggle opened already pressed to
  List.
- [x] Section headers (`CategoryIcon` + name + count), same `CATEGORIES` + Other
  order, "See all" past 4 — code match to `Pantry.jsx`'s own section block;
  visually confirmed on fixture data across Breakfast(2)/Dinner(2)/Dessert(1).
  Overflow itself (>4 in one section) wasn't exercised by the fixture data — the
  grouping/order logic is identical to `Pantry.jsx`'s, which does have overflow
  coverage already.
- [x] Grid view unchanged — still `RecipeCard`, still pills on cards; confirmed by
  reading `Pantry.jsx`'s grid render path (untouched) and by screenshot.
- [x] "Copy to Pantry" works in both views — grid: unchanged, same `RecipeCard`
  prop wiring as before. List: new plus-icon button per row; a scripted click on
  it (by exact `aria-label`, not a fuzzy role-name match that first caught a false
  positive by matching the row's own button instead) called `pocketRecipe` with
  the correct recipe id and did **not** navigate away — confirmed via
  `window.__pocketed` captured inside the page.
- [x] My Pantry's own list view has zero regression — separate guest-mode run
  against `/`: list view still shows the heart (not a plus button) on every row,
  `0` rows contain a `[aria-label="Copy to Pantry"]` element.

No console/page errors in any of the above runs.

**Screenshots** (real friend profile, fixture recipes across Breakfast/Dinner/
Dessert, one genuinely long title to sanity-check wrapping even though this task
didn't touch row typography):
`/home/roni/agent/artifacts/pantry-friend-listview-20261106/390-grid.png`,
`390-list.png`, `1440-grid.png`, `1440-list.png`, plus
`regression-my-pantry-list.png` for the My-Pantry sanity check.

**How the friend profile was reached for testing**: no real second account exists
on this machine, so a headless Chromium harness (same pattern as
`artifacts/pantry-friends-search/live-search.mjs`) patched `AuthContext` to a fake
signed-in user and `lib/firestore.js`'s friend-related functions to fixture data,
then navigated straight to `/friends?friend=u-hannah` (the real URL shape
`FriendProfile` already uses). Everything else in the app — routing, the actual
`FriendProfile`/`RecipeViews` components, real Tailwind/build output — is real,
only the Firestore calls are stubbed. Not click-tested against live Firebase (no
test account with friends + categorized recipes on this machine).

**Not doing, respected**: no favorites/liked split invented for friend sections
(plain category grouping only); `Pantry.jsx` untouched beyond the
`ViewToggle`/`RecipeListView` extraction; didn't touch the bottom-gap bug or the
heart/pantryIds quirk on friend cards.

**Not pushed** — prod push needs his go-ahead per standing rule (VERIFY.md,
FEEDBACK.md).
