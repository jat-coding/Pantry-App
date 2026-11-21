# Import: drop section-heading ingredient rows

## Symptom (Mr. Roni)
Imported "The Best Brussels Sprouts Recipe" showed a bare "Ingredients" row (no qty, no unit)
as its first ingredient. Must never show.

## Done when
- Heading-only rows (Ingredients, For the X, trailing colon; no qty, no unit, no digits) are
  dropped on server import (coerceRecipe) and on every client path (sanitizeRecipe covers
  Claude/JSON-LD/video import and editor load). Real qty-less items ("3-4 slices bacon") kept.
- Step -> ingredient link indexes re-pointed past dropped rows.
- Test with the Brussels sprouts shape. Existing saved recipe cleaned.

## Result — 2026-11-20 (v1.39.8, local commit on main only, not pushed)
- `api/_lib/ingredientHeading.js` `isIngredientHeading()`, shared by server and client.
  No group-label field exists in the data model, so headings are dropped, not kept as labels.
- Prompt also tells the model not to emit headings.
- `tests/ingredientHeading.test.js`; npm test 55/55 pass; vite build OK.
- Firestore: scanned all recipes, one hit (JQ8nlKAgve9nfhr2tlzE, Brussels sprouts). Patched
  `ingredients` only (links were {}); re-scan shows 0. Backup:
  `~/agent/artifacts/pantry-backups/2026-11-20-brussels-before-heading-fix.json`.
- Not verified: a fresh live import on the deployed site (not pushed, so prod still runs the
  old server code; the saved recipe is already clean regardless).
