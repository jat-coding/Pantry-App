# List view: remove category pills so titles are readable

## His words

> [voice memo, 9:43 AM 10/21] "Remove the little pills for their categories so you can
> have more space for the title. We still can't read the title of the recipes. We need
> to fix that."

(Photo attached showing the live list view: "Maple Sea Salt..." still clipped to
"Maple" / "Sea Salt..." across 2 lines, with Breakfast/Snacks pills eating the row's
right side.)

## Goal

List-view recipe rows (`RecipeListView` in `src/pages/Pantry.jsx`) drop the
category-pill column entirely so the title gets the full remaining row width and
actually reads in full.

## Done when

- The category pills (`pill-peach` spans under `getCategories(r)`) are gone from the
  list-row markup — no category chips render in list view.
- The title's flex column now spans the space the pills used to occupy (liked-heart +
  title + "by X"/"Pocketed from X" line + Time only).
- A long real title ("Maple Sea Salt Bagel [full name]" or similar from his existing
  data) reads in full within its line-clamp at 390px width — confirmed by screenshot,
  not just code inspection.
- Time column still sits at the far right (kept from the 10/20 fix).
- `npm run build` and `node scripts/check-jsx-imports.mjs` both pass clean.
- `npm test` still passes (no scaling.js touched, but confirms nothing else broke).

## Reference

none (phone screenshot of his own live list view is the bar — matches it minus pills).

## Not doing

- Not moving category info elsewhere in the row (into the subtitle line, a badge, etc.)
  unless he asks — his literal instruction is to remove them for space, not relocate
  them.
- Not touching the grid view (the other toggle, `isLiked`/grid icon) — this is list view
  only.

## Tries

5

## Open questions

none — instruction is unambiguous.

## Result (2026-10-21)

- Category pills removed from `RecipeListView` (header + row), `getCategories` import
  dropped (no longer used). Title span now spans the full row next to the thumbnail,
  Time only. **Done.**
- Verified via a local mocked-Firebase harness (list view, 390px) with his real recipe
  title "Maple Sea Salt Banana Bread" — now reads in full across 2 lines with no
  clipping. Screenshot: `artifacts/pantry-remove-pills-2026-10-21/list-390-real-title.png`.
  **Done.**
- Time stayed at the far right. **Done.**
- `npm run build`, `node scripts/check-jsx-imports.mjs`, `npm test` all pass clean.
  **Done.**
- v1.33.1 bumped in `src/lib/version.js` with a changelog entry (the prior "v1.33.1"
  commit message never actually bumped the in-code version, so this is the first real
  1.33.1). Committed locally as `8b5c52d`, **not pushed** — prod push needs his go-ahead
  per standing rule.
