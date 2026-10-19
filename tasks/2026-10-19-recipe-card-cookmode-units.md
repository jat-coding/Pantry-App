# Recipe index card, cook-mode layout, source link, unit conversion

## Goal

Six go-forward UX/feature changes Mr. Roni sent together on 10/19: turn the recipe
share/PDF card into a concise, photo-free index-card layout; fix the bottom-nav pill and
cook-mode Prev/Next bar so they actually sit where they look like they should; add a
clickable "Original" source link to a recipe when one exists; show each cook-mode step's
own ingredient amounts under the instruction; and let a reader convert oz into cups/tbsp/tsp,
defaulted and rounded to the nearest half unit.

## Done when

1. **Index-card PDF** (`src/lib/recipePdf.jsx`, built 2026-10-17 per
   `tasks/2026-10-17-recipe-pdf-share.md` as a photo-forward reference card): the photo is
   removed from the generated card entirely (no image box, no broken-image placeholder),
   and the layout is reflowed into a concise single-page index-card style — title, a
   compact stat row (serves/prep/cook), ingredients, numbered method, source credit — with
   no component scaled so small it's unreadable at default PDF zoom. Generate a card for a
   recipe that previously had a photo and confirm no image appears and nothing is left
   oddly blank where it used to be.
2. **Tab-bar pill** (`src/components/Layout.jsx`, the `pillRef` div): the active-tab
   highlight is a rounded square/rounded-rect that fills most of the tab's own hit area
   (icon + label), not a circle with visible gaps top/bottom or side/side — compare before
   vs. after against `/home/roni/agent/bridge/run/photos/jatbot-7580995491_0-1792424052513-IMG_0822.jpg`.
   Check on both the 2-tab-wide mobile bar and that nothing clips the label text.
3. **Cook-mode Prev/Next bar** (`src/pages/RecipeDetail.jsx`, the bar currently positioned
   `bottom-[calc(env(safe-area-inset-bottom)+6.5rem)]`): since the mobile tab bar is hidden
   during Cook Mode (`!cookMode &&` in Layout.jsx), this bar should sit flush with the
   true bottom safe area on mobile (`bottom-[env(safe-area-inset-bottom)]` or equivalent),
   not floating ~6.5rem above empty space. Desktop (`sm:bottom-0`, sidebar layout) stays as
   is. Confirm at 390px width with Cook Mode on: no dead space below the bar, bar doesn't
   overlap the last instruction step either.
4. **Original-source link**: recipes imported from a URL (`src/pages/ImportModal.jsx` ->
   `src/lib/jsonld.js` `extractRecipeFromHtml`, and the Claude-text/video normalize paths)
   currently discard the source URL entirely — it's not on the recipe object, not saved to
   Firestore. Thread it through as `recipe.sourceUrl` (import -> editor draft -> save ->
   Firestore `createRecipe`/`updateRecipe`), and on `RecipeDetail.jsx` show a button/link
   labeled "Original" near the bottom of the page (after Instructions) that `window.open`s
   `recipe.sourceUrl` in a new tab when present — nothing rendered when it's absent (manual
   from-scratch recipes, pre-existing recipes with no stored source). Raw URL text is never
   shown, only the "Original" label.
5. **Per-step ingredient amounts in Cook Mode**: each instruction's `<li>` in
   `RecipeDetail.jsx` gets the exact ingredient amount(s) that step calls for shown under
   the instruction text, when Cook Mode is on. Source the amounts by matching ingredient
   names mentioned in that step's text against `scaledIngredients` (case-insensitive
   substring match is enough — this app has no existing step-to-ingredient linking data
   model to build from) and list name + current scaled qty/unit for each match. A step
   with no matched ingredient (e.g. "Preheat the oven") shows nothing extra — no empty
   line, no "no ingredients" placeholder.
6. **Oz -> cups/tbsp/tsp conversion, default + half-unit rounding**: `src/lib/scaling.js`
   already converts oz (weight family) and fl-oz/cup/tbsp/tsp (volume family) but they're
   two separate `UNIT_FAMILIES` so oz can't convert into volume units today (correctly —
   weight and volume aren't interchangeable in general). Scope this to what he's actually
   asking: fluid ounces (`fl oz`), which the volume family already has, convert cleanly
   to cup/tbsp/tsp. Make cup/tbsp/tsp the picker's default/first option for any ingredient
   whose recipe unit is `fl oz` (instead of defaulting to fl oz itself), and round the
   *displayed* converted quantity to the nearest 0.5 (never a value like 0.899 — round to
   1 or nearest half) without touching the underlying stored/scaled precision used for
   grocery-list math. If a true oz-is-actually-volume ambiguity comes up in testing (a
   recipe using plain "oz" to mean a fluid ounce, which `scaling.js` currently treats as
   weight), note it in the report rather than silently reclassifying units — that's a
   data-model call, not a layout one.
7. `npm run build` succeeds, no new console errors/warnings.
8. APP_VERSION bumped + a dated CHANGELOG entry added, user-facing language (standing rule).
9. Manual pass confirms nothing already working regresses: Cook Mode toggle, ingredient
   scaling/unit switching, Add to Grocery, PDF share for a recipe WITH a photo and one
   WITHOUT, edit/delete (owner only).

## Not doing

- Not retrofitting `sourceUrl` onto recipes that already exist without one — the "Original"
  button just doesn't show for those, no backfill/migration.
- Not building a full step-ingredient linking data model (step authors tagging exact
  ingredient refs) — substring matching against existing ingredient names is the scope.
- Not expanding unit conversion beyond fl-oz<->cup/tbsp/tsp (no oz(weight)<->volume, no
  metric<->imperial expansion) unless testing surfaces that he actually meant something
  broader — ask rather than guess if that comes up.
- Not pushing to prod — Pantry is localhost-test-before-prod (standing rule); this lands
  on `npm run dev` / localhost + Tailscale URL only, prod push is his call after he's seen it.

## Tries

5

## Open questions

None blocking — proceeding on the interpretation above (index-card = the existing
share/PDF card reference built 2026-10-17, reworked per his new instructions). If that
turns out to mean something else (e.g. the list/grid `RecipeCard.jsx` thumbnail shown on
Recipes/Pantry screens), that's a rebuild, not a tweak — flag it in the report rather than
guessing again.

## Result — 2026-10-19 (v1.26.0, local commit only, not pushed)

Built in 2 build-and-check tries (try 1: banana-bread PDF spilled the new source-credit
line onto a blank 2nd page -> moved it into the last page's footer margin; try 2: all
pass). Harness: real RecipeDetail + Layout with mocked data, 390x844 (and 1280x800 for
desktop), Chromium + WebKit, 37/37 each, plus 5/5 source-link thread checks. Evidence:
`/home/roni/agent/artifacts/pantry-cardunits-2026-10-19/` (run.mjs, source-thread.mjs,
harness/, screenshots, PDFs, *-results.json). Full report:
`/home/roni/agent/artifacts/build-20261019-160404-1775187.md`.

- [x] 1 Index-card PDF — PASS. Photo path removed end to end (no loadPhoto/drawPhoto, no
  photo block). Title + Serves/Prep/Cook line + rose rule + Ingredients + numbered Method,
  "Source: site.com" footer when the recipe has a sourceUrl. Banana bread (has a photo):
  1 page, no image box, no blank hole; minimal recipe: 1 page; 18 steps: 2 pages, clean
  snake flow. Body text 15px on a true-size Letter page.
- [x] 2 Tab-bar pill — PASS. Was 56x53 rounded-full; now 60x53 rounded-2xl (16px), pill =
  the tab's own box, every label inside its pill on all 4 tabs (before/after PNG).
- [x] 3 Cook-mode bar — PASS. 390px: bar bottom = 844 = viewport, tab bar gone; last step
  ends at 689 vs bar top 768. Desktop: bottom 0, left 240 (unchanged).
- [x] 4 Original link — PASS. URL/Video/shared-link imports pass the link to the draft;
  JSON-LD also sets it; sanitizeRecipe keeps http(s) only; editor Save -> createRecipe and
  edit -> updateRecipe both carry it (checked); createRecipe writes it to Firestore.
  Button after Instructions, window.open(_blank); no button without a source; raw URL
  never rendered. Not exercised: a live import through the bridge (code-traced only).
- [x] 5 Per-step amounts — PASS. Preheat step: nothing; "salt" vs "flaky sea salt" and
  "sugar" vs "brown sugar" resolved longest-first; follows scaling; hidden outside Cook Mode.
- [x] 6 fl oz -> cup/tbsp/tsp — PASS. Defaults 8 fl oz=1 cup, 1.5=3 tbsp, 3=6 tbsp,
  0.3=2 tsp; picker cup/tbsp/tsp first; x1.25 shows 1.5 cup / 7.5 tbsp / 2.5 tsp; grocery
  gets 7.5 tbsp / 2.25 tsp unrounded. Plain oz untouched (g,kg,oz,lb). JSON-LD importer now
  parses "fl oz"/"fl. oz."/"fluid ounces". NOTE: the Claude import prompt only lists "oz",
  so Claude-imported liquids likely arrive as plain oz (weight) -- flagged, not changed.
- [x] 7 npm run build — PASS, no warnings (same output as before the change); 0 console
  warnings/errors in the harness.
- [x] 8 APP_VERSION 1.25.1 -> 1.26.0 + dated CHANGELOG entry.
- [x] 9 Regression pass — PASS: Cook Mode toggle/Prev/Next/Exit, scaling, unit switch
  (6 oz butter -> 170.1 g), Add to Grocery, PDF with and without photo, long PDF, Edit +
  Delete (owner), hidden for non-owner.

Open question outcome: built on the stated interpretation (index card = the share/PDF
card). Not verified on a real iPhone.
