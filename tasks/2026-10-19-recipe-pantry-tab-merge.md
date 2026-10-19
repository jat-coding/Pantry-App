# Fold All Recipes into the Pantry tab

## Goal

Drop the redundant "My Pantry" (favorites) vs "All Recipes" (library) split. One screen
at `/`: liked recipes shown first within their category, the rest of the collection
below. Remove "Recipes" as its own nav tab.

## Done when

1. `/recipes` (AllRecipes.jsx) is gone — its content now lives on `/` (Pantry.jsx).
   AllRecipes.jsx and its route in App.jsx are removed, not left dead.
2. The merged screen groups recipes by category (`CATEGORIES` order from
   `src/lib/categories.js`). Within each category section: liked recipes first, then up
   to ~4 unliked ones, then a "See all" control if more than ~4 unliked remain in that
   section. A category with zero recipes doesn't render a section/header.
3. A recipe with multiple categories (`getCategories()` returns an array) appears in
   exactly one section — its `primaryCategory()` — never duplicated into a second
   section.
4. Search still filters across the whole merged view (not just one section); sort
   control still works (Newest/A–Z/Cook time) — decide where these controls live on the
   single screen and keep them reachable, don't just delete them.
5. Existing Pantry.jsx behavior survives the merge: grid/list view toggle, the help
   modal, the first-run onboarding, and the empty state (no recipes at all yet).
6. Nav (`src/components/Layout.jsx` TABS) drops to 3 tabs: Grocery, Pantry, Friends.
   No dead 4th slot, no broken link where "Recipes" used to be. (A future "Cook/Plan"
   tab is explicitly out of scope — see Not doing.)
7. Nothing else in the app still links to `/recipes` (check `navigate('/recipes')` /
   `to="/recipes"` call sites, e.g. Pantry's old empty-state "Browse all recipes"
   button — repoint or remove).
8. `npm run build` succeeds, no new console errors/warnings.
9. `APP_VERSION` bumped + dated CHANGELOG entry in `src/lib/version.js`, user-facing
   language.
10. Regression pass: Cook Mode, ingredient scaling/unit switching (incl. the
    unit-next-to-amount layout from v1.26.1, already committed), Add to Grocery,
    recipe edit/delete, PDF share — none of these should be touched by this change, but
    confirm the merge didn't collaterally break the page they live under.

## Not doing

- Not building a replacement tab (Cook/Plan or anything else) for the freed nav slot —
  he said drop to 3 tabs for now; that's a separate, not-yet-scoped feature.
- Not changing what "liked" means or how favoriting works, only how liked vs. not-liked
  recipes are laid out.
- Not pushing to prod — localhost-test-before-prod (standing rule); lands on
  `npm run dev` / localhost + Tailscale URL, his call after he's seen it.

## Tries

5

## Open questions

None blocking — all three scope questions (dedup to primary category, ~4-then-see-all
cap, drop to 3 tabs) were asked and answered in-room 2026-10-19. Proceeding without
further confirmation per standing rule (locked spec -> launch, don't re-ask).
</content>

## Result — 2026-10-19 (v1.27.0, local commit only, not pushed)

Built in 2 build-and-check tries (try 1: 31/33. "Heart a recipe -> it jumps to the top of its
section" didn't re-render because the grouping memo keyed off the isInPantry function's
identity -> now keys off pantryIds directly. The other failure was a harness selector bug.
Try 2: all pass). Harness: real Pantry + Layout + RecipeDetail with mocked data (16-recipe
library: 8 Breakfast with 2 liked, 4 Dinner, a Snacks+Lunch recipe, a legacy
"Appetizer" recipe, empty Lunch/Drinks), 390x844 + 1280x800, Chromium + WebKit: merge
checks 33/33 each, regression suite 37/37 each. Evidence:
`/home/roni/agent/artifacts/pantry-tabmerge-2026-10-19/` (run.mjs, regress.mjs, harness/,
screenshots, *-results.json, regress/). Full report:
`/home/roni/agent/artifacts/build-20261019-165718-2018381.md`.

- [x] 1 /recipes gone — PASS. `src/pages/AllRecipes.jsx` deleted (git rm), import + route
  removed from App.jsx; `grep -rn "AllRecipes\|'/recipes'" src` -> only the AllRecipes.com
  site name in the import hint. The now-unused RecipesIcon was removed too.
- [x] 2 Category sections — PASS. Order Breakfast, Dinner, Dessert, Snacks, Sauces & Dressings,
  Other (Lunch/Drinks have 0 recipes -> no header). Breakfast = 2 liked + 4 unliked + "See all
  Breakfast (2 more)" -> expands to 8 / "Show fewer" collapses to 6; Dinner with exactly 4
  unliked -> no button. Hearting a Dinner recipe moves it to the top of Dinner.
- [x] 3 Dedup — PASS. Trail Mix Wraps (Snacks + Lunch) renders once, in Snacks; 14 cards on
  the page, 14 unique.
- [x] 4 Search + sort — PASS. Controls stay at the top (sort bottom 234px, first section
  324px, on screen at 390x844). Search "cream" finds hits in Dinner, Dessert and Sauces.
  While searching, the See-all cap is off (all 8 Breakfast "a" matches shown). A-Z and Cook
  time sort the liked block and the rest separately; the category chips still filter.
- [x] 5 Existing behavior — PASS. Grid/list toggle (list view keeps sections, liked rows get a
  small heart, choice persists), help button opens the modal, first run opens it on its own,
  returning visit doesn't, empty state shows with no recipes.
- [x] 6 Nav 3 tabs — PASS. Mobile bar: Grocery, +, Pantry, Friends (no 4th slot, active pill
  on Pantry, each tab navigates and highlights); desktop sidebar: Grocery List, My Pantry,
  Friends, Profile.
- [x] 7 No /recipes links — PASS. Empty-state button repointed to "Write a recipe" -> /new;
  RecipeDetail back fallback and RecipeEditor save fallback -> "/"; 0 `a[href="/recipes"]`.
- [x] 8 npm run build — PASS, exit 0, 0 warning/error lines; 0 console warnings/errors in the
  harness in either browser.
- [x] 9 APP_VERSION 1.26.1 -> 1.27.0 + dated CHANGELOG entry.
- [x] 10 Regression — PASS, previous suite re-run against this tree: Cook Mode (bar flush,
  Prev/Next, Exit restores tab bar), per-step amounts, scaling, unit switching incl. fl oz and
  unit-next-to-amount rows, Add to Grocery, Edit/Delete owner-only, PDF (3 recipes), Original
  link, tab pill. Opening a recipe from an expanded section and going Back keeps it expanded.

Also changed: Profile stat "In Pantry" -> "Hearted" (it would read wrong now that every recipe
is in Pantry); help modal's Pantry line reworded. Not verified on a real iPhone or against
live Firebase data.
