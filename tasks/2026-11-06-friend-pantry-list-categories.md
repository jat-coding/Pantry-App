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
