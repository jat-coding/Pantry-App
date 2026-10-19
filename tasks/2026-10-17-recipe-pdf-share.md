# Recipe PDF share/print

## Goal

From any recipe's detail page, generate a clean one-page(ish) PDF of that recipe
(photo, title, times/servings, ingredients, instructions) and hand it straight to the
iOS share sheet so it can go out over text, Messages, Mail, Files, etc. — same button
works for every recipe in the app, not a one-off.

## Done when

- A share/PDF button is visible on every recipe's detail page (not just one recipe).
- Tapping it on an iPhone (Safari/PWA) opens the native share sheet with a real PDF
  file attached — confirmed via `navigator.canShare({ files })` gating, not just
  `navigator.share` existing.
- The PDF visually matches the reference template he sent (photo at
  `bridge/run/photos/jatbot--1004427257155_0-1792277939977-IMG_0812.jpg`, a "Honey
  Garlic Glazed Salmon" card): small-caps eyebrow category label + two flourish marks,
  large serif title, a 4-stat row (Serves / Prep / Cook / Total) each with a circular
  icon, two-column body (Ingredients left, numbered Method steps 01.. right), a divider
  with a small center ornament, a boxed "Chef's Note"-style callout (reuse for things
  like a "Pocketed from X" / source credit line since this app doesn't have chef notes),
  and the dish photo bottom-right with rounded corners. Warm cream background,
  dusty-rose accents, serif headline font. Doesn't need to be pixel-identical, but the
  same sections, same layout, same visual language.
- The PDF includes: recipe photo (when the recipe has one), title, prep/cook time,
  servings, the full ingredient list, and the full instructions list — using the
  recipe's *current scaled view* (whatever servings/units the reader has dialed in),
  not always the stored base quantities.
- Text in the PDF is legible at default zoom when opened in iOS Preview/Files (not
  microscopic, not a screenshot of the phone screen).
- A recipe with no image still produces a correct PDF (no broken image box, no crash).
- A recipe loaded from a Firebase-Storage-snapshotted image renders into the PDF without
  a CORS/tainted-canvas error (snapshotting already exists for this exact reason —
  `src/lib/imageSnapshot.js` — so this must actually use snapshotted URLs, not the raw
  source URL some recipes still carry pre-snapshot).
- Devices without file-share support (older Safari, desktop) fall back to a plain
  download of the PDF — no dead button, no silent no-op.
- `npm run build` succeeds with no new console errors/warnings from the PDF path.
- APP_VERSION bumped + CHANGELOG entry added (standing rule for every Pantry commit).
- No existing behavior on RecipeDetail regresses (Cook Mode, scaling, edit/delete, add
  to grocery) — manual pass through each after the change.

## Not doing

- No server-side/headless-browser PDF rendering (adds a new serverless function +
  Chromium dependency for marginal typography gain; client-side is enough here and
  matches how the rest of this app is built).
- No bulk "export all recipes" PDF — one recipe at a time, from its own detail page.
- No print-stylesheet/`window.print()` fallback path as the primary mechanism — this is
  about one-tap share, not the multi-step iOS print-to-PDF flow.
- No new design system / theming work beyond making the PDF itself readable.

## Tries

5

## Decided

- PDF engine: client-side — render a hidden DOM node styled to match the reference
  template, snapshot it with `html2canvas` (respects existing image-snapshot CORS fix
  since it reads already-loaded `<img>` elements), embed into a PDF with `jsPDF`. No new
  serverless function, no headless-browser dependency.

## Open question (asked him, build starts on the default below without waiting)

1. Button placement: Recipe Detail page only (**default — build starts with this now**)
   vs. also a share icon on each card in the recipe list. If he wants the list-view icon
   too it's a quick follow-on, not a redo. **Answered: detail-page only.**

## Send-back — 2026-10-17 (see FEEDBACK.md)

Pushed/deployed v1.22.0, then he tested on-device and found:
1. The recipe photo never actually appears in the generated PDF.
2. A long method list is squeezed onto one page instead of flowing to a second page.

Added to Done when:
- A recipe with a real Firebase-Storage photo produces a PDF where the photo visibly
  renders (open the actual file, not just check the code path didn't throw).
- A recipe with 15+ instruction steps produces a PDF where the method section is not
  clipped/overlapping and continues onto a second page.

### Send-back result (v1.22.1, commit d4026c5, local only)
- Pagination: fixed. Root cause confirmed (one page sized to full content height).
- Photo: could NOT reproduce off-device (desktop WebKit + Chromium both render it, small and
  2.9 MB photos, cross-origin Firebase-style URL). The "paint timing" theory is wrong:
  html2canvas loads background images itself and waits for them. Fix removes html2canvas
  from the photo path entirely (photo painted onto the canvas directly) + adds fallback
  sources + logs why a photo was skipped. Still needs his on-device check.
- Evidence: artifacts/pantry-recipe-pdf-fix-2026-10-17/

## Layout revision — 2026-10-17 7:23pm (after v1.22.1 pushed/live)

He wants, on top of v1.22.1:
1. Photo moved to the front: just above the Ingredients section in the left column
   (not bottom-right of the Method column where it is now).
2. Remove the "From the Kitchen Of" / "Pocketed From" note box entirely — not just for
   this recipe, the whole feature.

He also asked to see an example rendered here in chat before anything else — send a
sample render (reuse the Playwright render harness from the send-back fix, see
`artifacts/pantry-recipe-pdf-fix-2026-10-17/`) as a photo to the room, don't just
describe it in text. Commit locally; do not push (standing rule, he says when).

### Layout revision result (v1.22.2, local only, not pushed)
- Photo moved to the top of the left column, above "Ingredients" (same rounded, cover-cropped box). Note box, its divider/ornament, ChefHat import, and the `note` prop + computation removed end to end (nothing else used it).
- Found and fixed while re-checking pagination: html2canvas drew all text ~15px below its layout position (its font-baseline probe is an <img> that Tailwind preflight makes display:block), so with the photo moved, page 1's cut on a long recipe sliced through a line in both columns. A style scoped to that probe, present only during the snapshot, fixes it. Side effect: all PDF text now sits where the CSS puts it (title slightly further from the stat row than in v1.22.1).
- Verified in WebKit + Chromium: short with photo = 1 page, short without photo = 1 page, 18-step = 2 pages with a clean break. Sample sent to the room (message 259). Evidence + harness: artifacts/pantry-recipe-pdf-v2/

## Layout revision 2 — 2026-10-17 7:48pm (real on-device PDF: "Maple Sea Salt Banana Bread")

He pushed v1.22.2/v1.23.0 live, then generated a real PDF on his phone and sent a
screenshot of both pages
(`/home/roni/agent/bridge/run/photos/jatbot--1004427257155_0-1792288048321-IMG_0817.png`).
Today's pagination (v1.22.1) slices the full two-column layout into page-height bands,
so page 2 repeats BOTH columns side by side (ingredients continuing on its own left,
method continuing on its own right) — functional but not what he wants.

He wants real "snake"/boustrophedon flow instead: Ingredients and Method are one
continuous read order. If Ingredients overflows its column, it continues into the
column to the right on the SAME page (where Method currently always starts) — Method
only starts once Ingredients is actually finished, wherever that lands. If Method then
overflows the page, it continues at the LEFT column of the next page, and so on.
Never two independent parallel columns being sliced horizontally.

He also wants the stat row (Serves/Prep/Cook/Total — today a tall bordered 4-cell row
with circular icons) squeezed down hard: "a little banner under the title", much
smaller/shorter than today, not the current large icon row.

**Before pushing, render this EXACT recipe and send the image here** — title "Maple Sea
Salt Banana Bread", Breakfast, Serves 4, Prep 15 min, Cook 1 hr, Total 1 hr 15 min,
ingredients: 6 oz softened unsalted butter, 7 7/8 oz brown sugar, 2 1/2 oz white sugar,
12 oz mashed banana, 2 eggs, 1/4 oz vanilla paste, 1/4 oz molasses, 8 3/4 oz
all-purpose flour, 1/8 oz baking soda, 1/8 oz salt, 8 tbsp buttermilk, 4 tbsp Grade A
maple syrup, 1 tsp flaky sea salt; method: (01) Preheat the oven to 325°F. Lightly
spray a standard loaf pan and line it with parchment. (02) In a stand mixer or large
bowl, cream the softened unsalted butter with the brown sugar and white sugar until
combined and fluffy. (03) Add the mashed banana and mix until combined. (04) Add the
eggs, vanilla paste, and molasses, then mix again. The batter will look split — don't
worry! (05) In a separate bowl, whisk together the all-purpose flour, baking soda, and
salt. (06) Add the dry ingredients to the wet ingredients and mix to combine. (07) Add
the buttermilk half at a time, mixing thoroughly after each addition. (08) Pour the
batter into the prepared loaf pan. Bake at 325°F until deeply golden and firm to the
touch, with an internal temperature of 200–205°F, starting to check around the
60-minute mark. (09) Remove from the oven and immediately pour the maple syrup over the
top. It absorbs quickly, so pour and spread with a pastry brush in small sections. (10)
Sprinkle the flaky sea salt over the top and let cool completely before slicing.

Do not push — he explicitly wants to see it rendered first.

## New: in-app PDF preview before sharing — 2026-10-17 7:50pm

Today `sharePdf()` in `src/pages/RecipeDetail.jsx` (~line 179) builds the PDF then
calls `navigator.share({ files: [file] })` immediately — straight to the OS share
sheet, no way to see the PDF first. He wants tapping Share to open an in-app preview of
the generated PDF (so he can see the formatting) with its own Share action in that
preview that then does the actual `navigator.share`/download. Keep the existing
`readyPdf` cache (a second tap must still share instantly without rebuilding) — the
preview's own Share button is itself a fresh tap/user-gesture, so it can call
`navigator.share` directly the same way the code does today.

Queued to run after the snake-flow/stat-banner job (job
20261017-195033-3441429) finishes, same repo checkout, to avoid two build agents
editing the PDF feature at once.

### Layout revision 2 result (v1.24.0, commit c9179cf, local only, not pushed)
- Snake flow done in JS, not CSS multi-column: pass 1 renders every block (photo, headings, each ingredient line, each step) in one column-wide strip and measures real heights in the real fonts; `flowColumns` assigns them down left col, right col, next page left...; Method always opens the next column after Ingredients end; a heading never strands at a column bottom. Pass 2 renders each page as its own fixed 816x1056 sheet with blocks absolutely placed, and each page is snapshotted separately (canvas is always one page, 1632x2112, so MAX_CANVAS_PIXELS is never near).
- Columns are now equal width (332px each) instead of 5fr/7fr, since either kind of content can land in either column.
- Stat row is now one ~36px line (was ~125px) with small inline icons.
- Banana bread now fits on ONE page (WebKit + Chromium). Sample sent: message 286. Long 3-page snake example rendered but not sent (send hook blocks made-up recipes in real rooms). Evidence + harness: artifacts/pantry-recipe-pdf-v3/

### In-app preview result (v1.25.0, local commit, not pushed)
- Share icon builds the PDF (or reuses `readyPdf` for the same view) and opens `src/components/PdfPreview.jsx`: full-screen sheet, title + X at top, every page stacked and scrollable, Close + Share at the bottom. Share calls `navigator.share({ files, title })` or downloads when file share isn't supported; closes on success, stays open on cancel; NotAllowedError toasts "Tap Share again".
- Preview shows the PDF's own page JPEGs (`buildRecipePdf` now returns `{ file, pages }`), not an iframe: iOS Safari renders only page 1 of a PDF in an iframe, unscrollable.
- Verified on the real RecipeDetail page with mocked data, Chromium + WebKit at 390x844: 12/12 checks pass. Harness + screenshots: artifacts/pantry-pdf-preview/. Not checked: real iPhone share sheet.
