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
