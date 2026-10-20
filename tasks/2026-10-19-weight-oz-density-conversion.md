# Weight-oz ingredients convert to cup/tbsp/tsp by default

## Goal

His original 9:34 AM instruction (screenshot) said "Allow the user to convert oz into
cups and teaspoons tablespoons. Those should be default and rounded to the nearest half
unit." The v1.26.0 build only implemented this for ingredients literally tagged
"fl oz" (liquids) and explicitly scoped weight-oz out of the task card's "Not doing"
section — narrower than what he actually asked for. This corrects that: weight-oz
ingredients (butter, sugar, flour, baking soda, salt, etc. — the common case, see his
10/19 7:33pm screenshot of Cook Mode on a cookie recipe) get cup/tbsp/tsp too.

## Done when

1. **Density table**: `src/lib/scaling.js` gets a name-keyed density table (grams per
   cup) for common baking ingredients — butter, granulated sugar, brown sugar,
   all-purpose flour, baking soda, baking powder, salt, cocoa powder, oats, powdered
   sugar, vanilla extract, vanilla paste, molasses, honey — using real baking-reference
   figures (e.g. flour ~120g/cup, granulated sugar ~200g/cup, packed brown sugar
   ~220g/cup, butter ~227g/cup), not invented round numbers.
2. **Name matching**: a weight-unit ingredient's name is matched against the table by
   keyword, longest/most-specific match wins, so "softened unsalted butter" matches
   "butter" and "brown sugar" matches its own entry rather than "sugar" false-matching
   it.
3. **Options + default**: `compatibleUnits` and `defaultUnitFor` take the ingredient
   name and, when the unit is weight (g/kg/oz/lb) and the name matches the table, add
   cup/tbsp/tsp to the option list and default to the largest of cup/tbsp/tsp that
   displays ≥1 (roundHalf) — same policy already used for fl-oz. Update every call site
   of these two functions to pass the name.
4. **Fallback unchanged**: an ingredient whose name doesn't match the table (e.g.
   "banana") stays exactly as today — weight-only, no new options, no guessed
   conversion.
5. **Conversion math**: `convertQty` routes a matched ingredient's weight↔volume
   conversion through grams → cups via its density → tsp/tbsp/cup, instead of the
   existing cross-family "return qty untouched" guard. That guard still applies to
   anything not in the table.
6. **No regressions**: stored qty/unit and grocery-list aggregation are untouched —
   display/conversion-layer change only, same as the existing fl-oz feature. Applies to
   all existing recipes immediately, no re-import needed.

## Reference

None — logic/data change to an already-built unit picker, not a new screen.

## Not doing

- Metric↔imperial unit families.
- Retroactive fl-oz-vs-plain-oz reclassification for existing recipes — separate open
  question to him, still unanswered as of this task (2026-10-19 9:09pm tap question).
- Any change to grocery-list unit preferences.

## Tries

5

## Open questions

None — density-table approach and weight-only fallback for unmatched names are
engineering calls, not branching decisions.

## Result — 2026-10-19 (v1.32.0, local commit only, not pushed)

Built in 1 build-and-check try (one harness rerun: the first page load raced a Vite
dependency re-optimize and reloaded mid-check; no code change). Evidence: new
`tests/scaling.test.js` (7/7, `npm test`, kept as real coverage) and the real
RecipeDetail driven with mocked data at 390x844, Chromium + WebKit, 10/10 each:
`/home/roni/agent/artifacts/pantry-weight-oz-2026-10-19/` (run.mjs, harness/, PNGs,
*-results.json, *-rows-default.json). Full report:
`/home/roni/agent/artifacts/build-20261019-211020-2779354.md`.

- [x] 1 Density table — PASS. `GRAMS_PER_CUP` in scaling.js, figures from King Arthur
  Baking's ingredient weight chart (flour 120, granulated sugar 198, packed brown sugar
  213, butter 227, powdered 113, baking soda 288 = 6 g/tsp, baking powder 192 = 4 g/tsp,
  table salt 288 = 18 g/tbsp, cocoa 84, oats 89, vanilla extract 224 = 14 g/tbsp, molasses
  340, honey 336) plus maple syrup, cornstarch, chocolate chips, peanut butter, other
  flours/sugars. Vanilla paste 320 = 20 g/tbsp is from a product label (Queen), not KA --
  KA doesn't list it. Brown sugar is 213 (KA), not the ~220 the card guessed.
- [x] 2 Name matching — PASS. Whole-word, longest key wins: "dark brown sugar, packed" ->
  213, "creamy peanut butter" -> 270, "salted butter" -> 227, "buttermilk" -> no match.
  Null entries keep false friends weight-only: kosher/sea/flaky salt (Diamond vs Morton
  differ 2x), almond/cashew/apple/cocoa butter, butter beans, flour tortillas.
- [x] 3 Options + default — PASS. compatibleUnits('oz','brown sugar') = cup,tbsp,tsp,g,kg,
  oz,lb; defaultUnitFor(7.88,'oz','brown sugar') = cup, shown 1 (exact 1.0488). Page:
  butter 6 oz -> 12 tbsp, brown sugar 1 cup, white sugar 5.5 tbsp, vanilla paste 1 tsp,
  molasses 1 tsp, flour 2 cup, soda 0.5 tsp, salt 0.5 tsp. All 5 call sites in
  RecipeDetail.jsx pass the name (only caller file; grep'd src/).
- [x] 4 Fallback — PASS. "banana"/"mashed banana": g,kg,oz,lb only, stays 12 oz,
  convertQty(4,'oz','cup','banana') returns 4 untouched.
- [x] 5 Conversion math — PASS. Weight -> g -> cups by density -> unit, and back for typed
  edits: 1 tbsp butter = 14.1875 g (227/16); oz->tbsp->oz round-trips to 0.001; typing
  2 cup brown sugar rescales flour to 4 cup (hand-checked 3.94) and banana to 22.9 oz.
  Unmatched cross-family still returns qty untouched.
- [x] 6 No regressions — PASS. Stored qty/unit untouched (display layer only). fl oz
  defaults unchanged (8 fl oz = 1 cup, 1.5 = 3 tbsp, 0.3 = 2 tsp); 6 oz butter -> 170.1 g;
  volume rows (buttermilk, maple syrup, flaky sea salt) untouched; Cook Mode step amounts
  follow (1/2 tsp soda, 2 cup flour). Grocery aggregation code not touched; as with fl oz,
  Add to Grocery sends the unit on screen at full precision (brown sugar 1.05 cup).
- [x] 7 npm run build — PASS, no warnings; 0 console warnings/errors in the harness.
- [x] 8 APP_VERSION 1.31.1 -> 1.32.0 + dated CHANGELOG entry.

Not verified: a real iPhone or real Firestore recipes (no Firebase keys here).

## Follow-up — cup rounding granularity (2026-10-19 9:36pm)

v1.32.0's "Need from you" flagged one side effect: `roundHalf`'s nearest-0.5 rounding
means a borderline cup value (e.g. 6 oz butter = 0.749 cup) fails the `>= 1` threshold
`defaultUnitFor` uses to pick cup, and falls through to tbsp (12 tbsp) instead of
showing 3/4 cup. He answered: **yes, allow quarter and third cups** (so 1/4, 1/3, 3/4
read naturally, not just whole/half).

9. **Cup rounding**: for the cup unit specifically, replace `roundHalf`'s nearest-0.5
   with a nearest-common-fraction rounding (quarters and thirds — reuse the existing
   `COMMON_FRACTIONS`/`nearestFraction` machinery `formatQty` already uses, rather than
   inventing a second fraction table) in both `displayQtyIn`'s output and the threshold
   `defaultUnitFor` uses to decide cup vs. tbsp/tsp. tbsp/tsp keep nearest-half — he
   scoped this to cups only. Acceptance: 6 oz butter now reads **3/4 cup** (not 12
   tbsp); the existing whole/half cases (8 fl oz = 1 cup, 7.88 oz brown sugar = 1 cup)
   are unchanged; re-run `npm test` and the UI harness from the first round to confirm
   no regression.

## Result: follow-up, cup rounding (2026-10-19, v1.32.1, local commit only, not pushed)

Built in 1 try. New `roundCup` in scaling.js snaps cup amounts to whole + quarter/third,
using `CUP_FRACTIONS` = `COMMON_FRACTIONS` filtered to quarters/thirds (no second table;
`nearestFraction` and `roundCup` share one `closestFraction` helper). Eighths are left
out on purpose: he said quarter and third cups, and 3/8 or 5/8 cup isn't a measuring cup.
`defaultUnitFor` picks cup when the snapped cup value is >= 1/2, else tbsp/tsp with the
old half-rounding >= 1 rule. The amount field on a converted cup row now shows the
fraction ("3/4", not "0.75"); parseQty already reads it back. Evidence:
`/home/roni/agent/artifacts/pantry-cup-rounding-2026-10-19/` (run.mjs reused from the
first round, harness/, PNGs, *-results.json). Report:
`/home/roni/agent/artifacts/build-20261019-213815-2841924.md`.

- [x] 9a 6 oz butter defaults to 3/4 cup — PASS. Unit test + harness row "3/4 cup
  softened unsalted butter" (Chromium + WebKit), Cook Mode text shows "3/4 cup".
- [x] 9b Nothing else on the page moved — PASS. Harness diffs every row against the
  v1.32.0 run's rows-default.json: only the butter row differs. Brown sugar 1 cup, white
  sugar 5.5 tbsp, flour 2 cup, soda/salt 0.5 tsp, vanilla paste/molasses 1 tsp, banana
  12 oz weight-only, volume rows unchanged, butter -> g 170.1, typed 2 cup brown sugar
  still rescales flour to 4 cup and banana to 22.9 oz.
- [x] 9c tbsp/tsp keep nearest-half — PASS. Butter picked as tbsp still 12; white sugar
  2.4 oz in tbsp 5.5; fl oz 8 = cup, 1.5 = 3 tbsp, 0.3 = 2 tsp unchanged (unit tests).
- [x] 9d npm test — PASS 8/8 (one new test; one old expectation changed, see below).
- [x] 9e npm run build — PASS, 0 warnings; 0 console warnings/errors in harness, 15/15
  checks per engine.
- [x] 9f APP_VERSION 1.32.0 -> 1.32.1 + dated CHANGELOG entry.

Intended side effect: a cup value between halves now lands on the closer quarter/third,
e.g. 10 oz flour (2.36 cup) reads 2 1/3 cup, was 2 1/2. The unit test for that case was
updated. Typing the shown "3/4" back into the butter field scales the recipe by
0.75/0.749 (about 0.1%), the same kind of drift typing a rounded tbsp value already had.
Not verified: a real iPhone or real Firestore recipes.
