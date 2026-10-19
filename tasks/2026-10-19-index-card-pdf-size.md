# Recipe PDF: index-card-size export option

## Goal

The existing recipe PDF (`src/lib/recipePdf.jsx`, `RecipePdfTemplate.jsx`) is laid out
index-card STYLE but sized for a sheet of paper (Letter). He wants the same card
content also exportable at actual physical index-card SIZE, like the sheet version is
sized for a sheet.

## Done when

1. A size choice is offered wherever the PDF share action lives on
   `src/pages/RecipeDetail.jsx` (e.g. two buttons/a toggle: "Full page" vs "Index
   card") — default stays the current full-page/Letter behavior, nothing regresses for
   someone who doesn't touch the new control.
2. Index-card size = 4x6 in (102x152mm), the standard US recipe-card print size —
   document this assumption plainly in the report; if he meant 3x5 instead, that's a
   one-constant change, flag it rather than silently guessing again.
3. Same content/layout language as the existing card (title, stat row, ingredients,
   numbered method, source credit) reflowed to fit the smaller page — on a short
   recipe it should look like a real recipe card, not a sheet shrunk down with huge
   empty margins; a long recipe paginates across multiple index-card pages rather than
   clipping or shrinking text unreadably (reuse the existing snake-flow/pagination
   logic, don't rebuild it from scratch).
4. Both the photo-having and no-photo recipe cases still render correctly at the new
   size (no broken image box, no blank hole).
5. `npm run build` succeeds, no new console errors/warnings.
6. APP_VERSION bumped + dated CHANGELOG entry, user-facing language.
7. Regression: the existing full-page/Letter PDF export is unchanged in output for a
   recipe tested before this change (same content, same page size).

## Not doing

- Not touching the in-app PDF preview's UI chrome (Close/Share bar etc.) beyond adding
  the size choice control itself.
- Not building a "send to a friend" delivery mechanism — he dropped that ask; this is
  export/share only, same as today (OS share sheet / download).

## Tries

5

## Open questions

None blocking — proceeding on 4x6in as the standard recipe-card size; flagged above if
wrong.
</content>

## Result (v1.31.0, 2026-10-19)

Evidence dir: `/home/roni/agent/artifacts/pantry-pdf-size-2026-10-19/` (run.mjs = PDF
generation, ui.mjs = UI checks, harness/ = the mocked-data vite harness that mounts the
real RecipeDetail page). Both Chromium and WebKit. Three recipes: Banana Bread with a
real photo (served from a local image server), the same with no photo, and an 18-step
recipe with a long title. Every PDF was captured from the real Share button flow and its
embedded page images extracted and opened.

1. **PASS** - "Full page | Index card" switch at the top of the PDF preview that the
   share button on RecipeDetail opens. Fresh open, untouched: `size=page`, Full page
   pressed, aspect 816/1056 (ui.mjs, both engines). Choice is kept for the rest of the
   visit (reopen showed card). Screenshots: `new-*-photo-{page,card}-preview.png`,
   `ui-*-2-desktop-card.png`, `ui-*-1-building-card.png` (spinner, both buttons disabled
   while the card builds).
2. **PASS** - 4x6in, held landscape (6in wide x 4in tall) like a real recipe card:
   MediaBox `0 0 432 288` pt on every card page. Assumption: 4x6 and landscape. For 3x5
   change `PDF_SIZES.card` in RecipePdfTemplate.jsx to width 480 / height 288 (and
   probably shrink the type a notch).
3. **PASS** - Same template + same snake flow (`flowColumns` now takes the size spec;
   no new flow code). Short recipe fits one card with no big empty margins
   (`new-*-photo-card-img2.jpg`). 18-step recipe: 3 cards, steps 1-4 / 5-16 / 17-18,
   nothing clipped, credit on the last card (`new-*-long-card-img{6,8,10}.jpg`). Card
   type is 11px body (8.25pt), snapshotted at 3x (288dpi, 1728x1152 per card).
4. **PASS** - Photo and no-photo cards both render complete, no image box or hole (the
   PDF is text-only by the 2026-10-19 decision, so the photo case must just not leave a
   gap: `*-photo-card` and `*-nophoto-card` are the same size and layout).
5. **PASS** - `npm run build` clean, no warnings. Zero console warnings/errors in all
   harness runs (React Router future-flag notices filtered, pre-existing).
6. **PASS** - APP_VERSION 1.31.0 + dated CHANGELOG entry.
7. **PASS** - Baseline Letter PDFs generated from the unmodified code first
   (`base-*`), then again after (`new-*`): same MediaBox 612x792, same page count, same
   file size, and every embedded page JPEG is byte-identical (md5) in both engines for
   all three recipes. File name unchanged (`banana-bread.pdf`); card is `-card.pdf`.

Not verified: a real phone print, and a real Firebase Storage photo (no keys here).
