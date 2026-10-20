# Existing recipes: plain "oz" liquids reclassify as fl oz

## Goal

v1.31.1 fixed the recipe-import prompt so a newly imported liquid (milk, broth, oil,
water, cream, wine, vinegar, juice) gets tagged "fl oz" going forward. Recipes already
saved with plain "oz" for a liquid, from before that fix, don't benefit — their unit
field is literally the string "oz", and the app has no other signal to go on. Mr. Roni
chose to reclassify these rather than leave them, and flagged (correctly) that for a
liquid this isn't a density guess like the weight-oz fix — fl-oz to cup/tbsp/tsp is an
exact unit conversion once you know something is a liquid. The only fuzzy part is
deciding which ingredient NAMES count as a liquid.

## Done when

1. **Liquid name list**: reuse the same liquid set already used to fix the import
   prompt (`api/_lib/recipe.js`): milk, broth, oil, water, cream, wine, vinegar, juice.
   Add obvious same-family words if you find them missing in the prompt's own text
   (e.g. "stock", "buttermilk") but don't invent a long list — keep it to what a home
   cook would unambiguously call a liquid. Reuse the whole-word, longest-match name
   normalizer already written for `GRAMS_PER_CUP` in `src/lib/scaling.js` — don't
   duplicate that logic.
2. **False friends stay weight/unclassified**: anything that contains a liquid word but
   isn't one stays untouched — e.g. "cream cheese" (not cream), "buttermilk" IS a liquid
   despite containing "butter" (make sure a substring match on "butter" doesn't win over
   the more specific "buttermilk" — same longest-match rule that already protects
   "peanut butter" in the weight table). Check for exactly this kind of collision
   against the `GRAMS_PER_CUP` table's existing keys (e.g. an ingredient must not match
   both a weight entry and a liquid entry) and resolve any overlap you find explicitly.
3. **Reclassification is a label, not a conversion**: when an ingredient's stored unit
   is literally "oz" (not already "fl oz") and its name matches the liquid list, it
   feeds into the SAME code path a literal "fl oz" tag already uses (`isFluidOunce`-
   driven logic in `compatibleUnits`/`defaultUnitFor`/`displayQtyIn`/`convertQty`) — the
   stored number is unchanged, nothing is written back to Firestore, no re-import
   needed. This should be close to a one-place change (wherever unit is normalized
   before those functions use it), not a rewrite of the volume-conversion math, which
   already works correctly for fl oz.
4. **No collision with the weight-oz feature**: an ingredient already handled by
   `GRAMS_PER_CUP` (the dry/baking density table from the last task) must not also be
   reclassified as a liquid, and vice versa. Confirm "butter" and "buttermilk" land in
   the right one respectively.
5. **No regressions**: every existing-working case (weight-oz staples from the last
   task, already-tagged fl oz, unmatched fallback ingredients like banana) comes out
   identical to before. Re-run `tests/scaling.test.js` plus the UI harness from the
   prior two rounds.
6. `npm run build` succeeds with no new warnings. Bump `APP_VERSION` and add a dated
   CHANGELOG entry. Update the Result section of this card with each check as
   PASS/FAIL and evidence. Local commit only, no push.

## Reference

None — logic change to existing conversion code, no new screen.

## Not doing

- Any Firestore write/migration — this is a runtime reclassification only.
- Expanding the liquid list beyond what a home cook would call unambiguous (don't add
  "cream cheese" or anything that's liquid-ish but not pourable).

## Tries

5

## Open questions

None — scope and approach are settled by his answer and the existing fl-oz machinery.

## Result

v1.32.2, 2026-10-19. Local commit only, not pushed.

Change: `src/lib/scaling.js` gains a `LIQUIDS` table and one `effectiveUnit(unit, name)`
helper (plain oz + liquid name -> "fl oz"), applied at the entry of `compatibleUnits`,
`defaultUnitFor`, `isKitchenRounded` and `convertQty` (`displayQtyIn` goes through
`convertQty`/`isKitchenRounded`). No new conversion math; the fl oz path is reused. The
whole-word longest-match lookup used by `gramsPerCup` was factored into `matchKey()` and
both tables use it. Nothing is written to Firestore.

1. Liquid list: PASS. Prompt words (milk, water, broth, stock, juice, oil, cream, wine,
   vinegar) + buttermilk + half and half. Exclusions (null): cream cheese, sour cream,
   ice cream, whipped cream, "cream of" (tartar/mushroom soup), condensed milk, powdered/
   dry milk, milk powder, milk chocolate, stock cube(s), water chestnuts, in water/oil/
   juice, oil packed.
2. False friends: PASS. Unit test "false friends with a liquid word stay weight" (12 names);
   harness row "4 oz cream cheese" stays oz with g/kg/oz/lb picker.
3. Label not conversion: PASS. `compatibleUnits('oz','milk')` deep-equals
   `compatibleUnits('fl oz')`; `convertQty(3,'oz','cup','chicken stock')` equals the fl oz
   result; harness N: milk -> fl oz shows the stored 8.
4. No collision with GRAMS_PER_CUP: PASS. Scripted check: 0 literal keys in both tables,
   0 liquid keys that match a density key, 0 density keys containing a liquid word.
   Precedence rule: any density-table match (including its null entries) means not a
   liquid, so honey/molasses/maple syrup/vanilla extract keep their density path. butter
   -> density (6 oz = 3/4 cup by 227 g/cup), buttermilk -> liquid (6 oz = 3/4 cup by volume).
5. No regressions: PASS. `npm test` 12/12 (8 old + 4 new). UI harness
   (`artifacts/pantry-liquid-oz-2026-10-19/run.mjs`, reused from the cup-rounding round)
   22/22 in Chromium and WebKit at 390x844: cookie recipe rows identical to the v1.32.1
   run (A2, values + units + pickers), tagged fl oz recipe identical to a pre-change
   baseline run (K), banana 12 oz weight-only (C), no console warnings (Z). Pre-change
   baseline for the new plain-oz recipe: milk 8 oz, broth 16 oz, oil 1.5 oz, buttermilk
   6 oz; after: 1 cup, 2 cup, 3 tbsp, 3/4 cup, Cook Mode the same.
6. Build: PASS, `npm run build` no warnings. APP_VERSION 1.32.2 + CHANGELOG entry.
