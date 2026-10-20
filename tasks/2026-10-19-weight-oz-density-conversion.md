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
