# Pantry recipe-PDF layout revision — 2026-10-17 7:23pm

Project: `/home/roni/agent/projects/Pantry-App`. Read
`tasks/2026-10-17-recipe-pdf-share.md` (full history, esp. the new "Layout revision"
section at the bottom), `src/components/RecipePdfTemplate.jsx`, and
`src/lib/recipePdf.jsx` first. v1.22.1 (commit d4026c5) is pushed and live; this is a
small layout change on top of it, not a redo.

## Two changes

1. Move the recipe photo from where it is now (bottom of the Method/right column) to
   the top of the Ingredients/left column, just above the "Ingredients" heading — the
   first thing in the left column, above the ingredient list. Keep its current look
   (rounded corners, cover-cropped) unless that genuinely conflicts with the new
   position; same component, new position in the JSX.
2. Remove the note box entirely (the "From the Kitchen Of" / "Pocketed From" callout
   and its divider/ornament) — delete the whole section, including the `note` prop
   plumbing in `recipePdf.jsx` if nothing else uses it afterward (check before deleting
   the prop itself; if `buildRecipePdf()` still computes `note` for some other purpose,
   leave the computation but stop rendering it — otherwise remove it end to end, don't
   leave dead code).

Moving the photo changes which column is taller, which interacts with the pagination
fix just shipped in v1.22.1 (canvas sliced into Letter-height pages) — re-check
pagination still works correctly with the photo in its new spot, for both a short
recipe and a long (15+ step) one.

## Before anything else: render and send him an example

He explicitly asked to see an example here in chat before further discussion. The
send-back fix job already built a Playwright render harness and sample renders in
`artifacts/pantry-recipe-pdf-fix-2026-10-17/` (e.g. `photo-short-page1.jpg`,
`long-page1.jpg`) — reuse that same approach/script rather than building a new one.
Render at least one sample (a recipe with a photo) with the new layout, save it under
`artifacts/pantry-recipe-pdf-fix-2026-10-17/` or a new `artifacts/pantry-recipe-pdf-v2/`
folder, then send it directly to him as a photo:

    bridge/scripts/send-telegram.sh --chat -1004427257155 --reply-to 246 --photo <path-to-jpg> --caption "<short plain caption>"

Do this before or alongside writing your Summary — he wants to actually see it, not
just read that it's done.

## Verify

- Photo renders above Ingredients in the actual output (open it, don't just trust the
  JSX diff).
- Note box is gone, no leftover empty space/divider where it used to be.
- Pagination still correct: a short recipe is one page, a long (15+ step) recipe still
  flows onto additional Letter-height pages, now with the photo repositioned.
- `npm run build` succeeds, no new console warnings.
- Bump `APP_VERSION` + `CHANGELOG` entry (standing rule).

## Scope / do not

- Don't touch anything else in the PDF template (stat row, eyebrow, title, method
  numbering) beyond what moving the photo requires.
- Don't push or deploy. Commit locally only — he says when (standing rule).

## Deliver

Send the sample photo to the room as described above. Then start your output file with
a "## Summary" block (TL;DR / What I found / Need from you, plain language, under
~2,500 characters, no em dashes) confirming both changes landed and the verify checks,
and noting the sample photo was already sent separately.
