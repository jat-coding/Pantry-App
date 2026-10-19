# Pantry recipe-PDF send-back fix — 2026-10-17

Project: `/home/roni/agent/projects/Pantry-App` (desktop checkout, repo root).
Read `tasks/2026-10-17-recipe-pdf-share.md` (full spec + the new "Send-back" section),
`FEEDBACK.md`, and `VERIFY.md` (new "Recipe PDF export" section at the bottom) first.

v1.22.0 (commit 0a943a2) is already pushed and live. He tested it on his phone and
reported two real bugs. Fix both, in this same codebase, same feature — this is not a
redo of the whole thing.

## Bug 1 — photo never appears in the PDF

`src/lib/recipePdf.jsx` `loadPhoto()` fetches the image, converts to a data URL, and
calls `img.decode()` on a throwaway `Image()` just to confirm it decodes — then passes
the same `dataUrl` string as `imageSrc` prop into `RecipePdfTemplate`. The template sets
it as a CSS `background-image` on a div (chosen over `<img>` specifically to get
`object-fit`/cover cropping, per the component's own comment about html2canvas ignoring
`object-fit` on `<img>`). Likely cause: `recipePdf.jsx` calls `html2canvas` right after
`document.fonts.ready` with no wait for that background-image to actually finish
decoding/painting in the DOM — the earlier `img.decode()` was on a *different* Image
object than the one the browser now has to decode for the CSS background, so it proves
nothing about paint timing for the real element. Confirm this theory by instrumenting
(or just reasoning through a repro) before fixing — don't guess-fix. Also sanity check
that `recipe.imageUrl` is actually the same field `RecipeDetail.jsx` uses to show the
photo on-screen today (worth one grep) — rule that out too.

Fix needs to make the snapshot wait for the real background image to be decoded and
painted before `html2canvas` runs (e.g. decode the image the DOM node will actually use,
or swap to an `<img>`-based approach with explicit `onload`/`decode()` plus whatever CSS
achieves the same cropped look html2canvas can actually rasterize).

## Bug 2 — long recipes should paginate, not get squeezed onto one page

`RecipePdfTemplate` has `minHeight: 1056` — note that 1056px @ 96dpi is exactly one
Letter page (8.5x11in), so the template already assumes one standard page. But
`recipePdf.jsx` measures `node.offsetHeight` (whatever the *actual* rendered height is,
which grows past 1056 for a recipe with a long ingredients or method list, since it's an
unconstrained two-column grid) and builds a single PDF page sized to that full height —
an oversized one-off page shape instead of real pagination. That's what reads as
"squeezed": everything crammed onto one (very tall, non-standard) page.

Fix: cap the page at the standard Letter height (1056px / the existing `hPt` for exactly
1056px of content), and when the rendered content is taller than that, slice the
snapshot canvas into multiple page-height chunks and call `pdf.addPage()` for each
additional one — same page width throughout. A recipe that fits in one page today must
still render as exactly one page (no regression). Keep using the existing `scale`/
`MAX_CANVAS_PIXELS` cap; just change how many PDF pages the one tall canvas gets sliced
into.

## Verify (bytes, not claims)

Add both cases to a manual check pass and show the actual output, per VERIFY.md's new
section:
- A recipe with a real photo (pick one that already has a Firebase-Storage snapshotted
  image in this app's data) → generate the PDF → open the actual PDF file → the photo
  must visibly render in it. Save the PDF under `artifacts/` and say you opened/looked at
  it, not just that the code ran without throwing.
- A recipe with 15+ instruction steps (make a temporary test recipe or temporarily pad
  an existing one's steps for the check if nothing in the data already has that many) →
  generate the PDF → confirm the method section is not clipped/overlapping and that it
  continues onto a second PDF page, both pages same width/style.
- A short recipe (existing default case) still produces exactly one page, unchanged.
- `npm run build` still succeeds, no new console warnings from the PDF path.
- Bump `APP_VERSION` in `src/lib/version.js` + add a `CHANGELOG` entry (standing rule,
  every commit).

## Scope

Fix these two bugs only. Do not touch the reference-template visual design, the
scope-settled list-view question (detail-page-only, already decided), or anything else
on RecipeDetail.jsx beyond what the fix requires. Commit locally when both checks pass.
**Do not push or deploy — he says when**, same standing rule as the original build.

## Deliver

Start your output file with a "## Summary" block (TL;DR / What I found / Need from
you, plain language, under ~2,500 characters, no em dashes) — that block is sent to his
phone as-is. State what the actual root cause of each bug was (not just "fixed it"),
and give the pass/fail for every check above with how you confirmed it.
