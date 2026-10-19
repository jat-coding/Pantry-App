# Cook tab: quick-launch into Cook Mode

## Goal

Repurpose the nav slot freed by the Recipes/Pantry merge (now 3 tabs) back to 4:
a "Cook" tab that jumps straight into Cook Mode for a recent or liked recipe, instead
of making him search for what he was just cooking.

## Done when

1. `src/components/Layout.jsx` TABS goes back to 4 entries: Grocery, Cook, Pantry,
   Friends (icon: reuse an existing cook/flame-type icon from `icons.jsx` if one fits,
   otherwise add one matching the existing icon style).
2. Tapping Cook navigates to a recipe's detail page with Cook Mode already on (reuse
   `CookModeContext`/the existing Cook Mode toggle on `RecipeDetail.jsx` — don't build a
   second cook-mode implementation).
3. Recipe picked, in order: (a) the most recently opened recipe (track this — e.g.
   localStorage, same pattern as Pantry.jsx's `VIEW_KEY`/`ONBOARDED_KEY` — on opening any
   recipe detail page, record its id); else (b) the most recently liked (hearted)
   recipe; else (c) if he has no recipes at all, Cook lands on an empty state ("No
   recipes yet" with a way to add one) rather than erroring or 404ing.
4. Tapping Cook again for a DIFFERENT recipe than currently showing (e.g. he opened
   something else since) updates to that new one next time, not stuck on the first
   pick ever made.
5. Exiting Cook Mode from this entry point behaves like exiting it normally elsewhere
   (back to the tab bar, recipe stays viewable without Cook Mode).
6. `npm run build` succeeds, no new console errors/warnings.
7. APP_VERSION bumped + dated CHANGELOG entry, user-facing language.
8. Regression: existing 3 tabs (Grocery/Pantry/Friends) + the friend-request badge
   (just shipped, lives on Friends) still work; Cook Mode entered the normal way (from
   a recipe's own detail page) is unaffected.

## Not doing

- Not building a real meal-planning calendar — this is a quick-launch shortcut only.
- Not letting the user pick which recipe Cook launches into from a list — it's
  automatic (recent, else liked, else empty state). If that feels wrong once built,
  that's feedback for next round, not a blocker now.

## Tries

5

## Open questions

None blocking.
</content>

## Result — 2026-10-19 (v1.30.0, local commit only, not pushed)

Built on try 1 of 5; every check passed the first full run (two harness fixes along the
way, not app bugs: the auth stub needed `isAuthed`, and Pantry's first-visit popup had to
be pre-dismissed). Harness: the REAL `src/main.jsx` -> `App` (real routes, Layout,
DataProvider, Pantry, RecipeDetail, CookLaunch, Friends, Grocery, StrictMode), with only
AuthContext, `lib/firestore.js` and `firebase.js` stubbed; recipes come from
`sampleRecipes`, plus one friend recipe readable only through `getRecipe`. Chromium +
WebKit, 390x844 + 1280x800, 50/50 each, re-run after the parallel friends-of-friends
commit (06a76ef) landed in the same tree. Evidence:
`/home/roni/agent/artifacts/pantry-cooktab-2026-10-19/` (run.mjs, harness/ — copy it to
`<repo>/.harness-cook` and start `npx vite --config .harness-cook/vite.config.mjs` to
re-run — screenshots, chromium-results.json, webkit-results.json). Not click-tested
against live Firebase (no keys on this machine).

- [x] 1 Four tabs — PASS. Bottom bar order Grocery, Cook, (+), Pantry, Friends; sidebar
  Grocery List, Cook, My Pantry, Friends, Profile. Every tab on screen at 390px with icon
  and label (Cook spans x 103-163). Icon: new `CookIcon` (lucide CookingPot, same 1.8
  stroke as the others); the existing ChefHat is already the Dinner category icon.
- [x] 2 Reuses Cook Mode — PASS. `/cook` (new `CookLaunch` page) replaces itself with
  `/recipe/:id` carrying `state.cook`; RecipeDetail just calls the existing
  `setCookMode(true)` on mount. Same exit bar, same toggle (checked), tab bar hidden,
  Prev/Next bar shown. No second implementation.
- [x] 3 Pick order — PASS. (a) Opening any recipe stores its id in localStorage
  `pantry-last-opened`; Cook goes there even when a different recipe is liked. A friend's
  recipe as last-opened also works (fetched via `getRecipe`). (b) Nothing opened, liked
  [r0, r2] -> r2 (newest heart; `arrayUnion` appends). Deleted last-opened + a stale
  like -> falls through to the next valid like, never "Recipe not found". (c) 0 recipes
  -> "No recipes yet" + Add a recipe (opens /new). Waits for recipes to load (3s delayed
  load: no empty-state flash, then opens). Judgment call: recipes exist but none opened
  or liked -> "Nothing to cook yet" + Go to My Pantry (spec only covered "no recipes").
- [x] 4 Follows the latest — PASS. Cook -> r1, open r2 later, Cook -> r2. Desktop: tap
  Cook in the sidebar while already cooking r2 (last opened now r0) -> r0 in Cook Mode.
- [x] 5 Exit — PASS. Exit: Cook Mode off, same URL, recipe still showing, tab bar back.
  The cook flag is removed from history right after use, so a reload stays out of Cook
  Mode. Back from the recipe returns to the screen before Cook (`/cook` is replaced, not
  left in history).
- [x] 6 Build — PASS. `npm run build` exit 0, no warnings/errors in output; zero console
  errors/warnings/page errors across all harness runs (React Router future-flag notices
  excluded, pre-existing).
- [x] 7 Version — PASS. APP_VERSION 1.29.0 -> 1.30.0 (1.29.0 was taken by the parallel
  friends-of-friends job), dated user-facing CHANGELOG entry; "1.30.0" in built bundle.
- [x] 8 Regression — PASS. Grocery/Pantry/Friends tabs each navigate and are the single
  active tab, both viewports; friend-request badge "2" shows exactly once, on Friends.
  Cook Mode via a recipe's own toggle still turns on/off as before.
