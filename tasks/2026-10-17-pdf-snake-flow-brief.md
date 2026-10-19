# Pantry recipe-PDF: snake column flow + compact stat banner — 2026-10-17 7:48pm

Project: `/home/roni/agent/projects/Pantry-App`. Read
`tasks/2026-10-17-recipe-pdf-share.md` (full history, esp. the new "Layout revision 2"
section at the bottom — it has the exact recipe data to test with), then
`src/components/RecipePdfTemplate.jsx` and `src/lib/recipePdf.jsx`. v1.23.0 is pushed
and live; this is a layout change on top of it, not a redo. LOOK at his screenshot:
`/home/roni/agent/bridge/run/photos/jatbot--1004427257155_0-1792288048321-IMG_0817.png`
— it shows today's behavior (two independent columns sliced across pages) so you can
see exactly what's wrong.

## Change 1 — real snake/boustrophedon column flow, not two parallel columns

Today `RecipePdfTemplate` is a fixed 2-column CSS grid (Ingredients always left, Method
always right), and `recipePdf.jsx` slices the full rendered height into page-height
bands for pagination — so a long recipe's page 2 shows BOTH columns continuing side by
side. He wants one continuous read order instead: Ingredients first, Method second, and
when content overflows a column it continues in the NEXT column over (which may be the
right half of the same page, or the left half of the next page), like a newspaper/
magazine snake layout. Method must never start until Ingredients has actually finished,
wherever that lands.

This needs a different layout technique than the current fixed-grid-then-slice
approach. The strongest candidate: render Ingredients+Method as ONE CSS multi-column
flow (`column-width`/`columns` with a fixed `column-height` equal to one page's content
height, `column-fill: auto` so each column fills completely before the next starts,
`break-inside: avoid` on ingredient lines and numbered steps so nothing splits mid-line)
— this gives you native snake flow for free. The catch: a CSS multi-column container
lays columns out side by side, growing the container's WIDTH as content overflows, not
its height — so the html2canvas capture becomes one very wide canvas containing every
column in a row, and pagination becomes slicing that wide canvas into page-width chunks
of 2 columns each (sideways from how `recipePdf.jsx` paginates today). Work out the
exact mechanics yourself; this is a genuine rendering-engineering problem, not a CSS
tweak — spend real effort getting the page slicing right rather than a first attempt
that happens to work for one test case. Watch `MAX_CANVAS_PIXELS` — a wide multi-column
canvas needs the same pixel-budget care the height-based slicing already has.

If true CSS multi-column columns turn out to be impractical with html2canvas (it can be
flaky with column layouts — verify, don't assume), a manual fallback is acceptable:
measure Ingredients' and Method's natural content heights yourself and construct the
page/column assignment in JS before rendering. Either way the visual result must be a
real snake flow, verified by actually looking at the rendered pages.

## Change 2 — compress the stat row into a slim banner

The stat row (Serves/Prep/Cook/Total, each a bordered cell with an 11-unit circular
icon, label, and value — tall, maybe 100px+) should become a small single-line banner
directly under the title: much shorter, no large circular icons, something like
compact inline labels/values in a thin bar. Use your judgment on exact styling — it
needs to still clearly show all 4 values, just take dramatically less vertical space so
more of the page goes to content.

## Before pushing: render the exact test recipe and send it

Use the exact "Maple Sea Salt Banana Bread" recipe data from the task card's "Layout
revision 2" section (title, Breakfast, Serves 4/Prep 15 min/Cook 1 hr/Total 1 hr 15
min, the 13 ingredients, the 10 method steps) — reuse the Playwright render harness
from `artifacts/pantry-recipe-pdf-v2/` (or build a fresh one off it), substituting this
exact recipe's data in place of the placeholder "Honey Garlic Glazed Salmon" test case.
Render it, save under a new `artifacts/pantry-recipe-pdf-v3/` folder, and send the
page(s) to the room as photos:

    bridge/scripts/send-telegram.sh --chat -1004427257155 --reply-to 1792284594586000 --photo <path> --caption "<short plain caption>"

Send every page (this recipe spans 2 pages at minimum today — confirm how many pages
it takes with the new snake flow and send all of them). Do this before writing your
Summary, and **do not commit anything as "ready to push" language — he wants to look at
it and decide**.

## Verify

- The exact test recipe above renders in real snake order: Ingredients fully, then
  Method starts wherever Ingredients ended (same page's other column or next page's
  first column), continuing correctly across however many pages it needs.
- A short recipe that fits on one page is unchanged/still one page.
- An existing recipe with a photo still shows the photo correctly (don't regress
  v1.22.1/v1.22.2).
- The stat banner is visibly much shorter than before, all 4 values still legible.
- `npm run build` succeeds, no new console warnings.
- Bump `APP_VERSION` + `CHANGELOG` entry (standing rule).

## Scope / do not

- Don't touch the photo-above-ingredients placement or the note-box removal from
  v1.22.2 — those stay as they are, just flowing differently now.
- Don't push or deploy. Commit locally only.

## Deliver

Send the rendered sample pages as described above FIRST. Then start your output file
with a "## Summary" block (TL;DR / What I found / Need from you, plain language, under
~2,500 characters, no em dashes): describe the actual technique you used for the snake
flow, confirm the verify checks, and say the sample was already sent and nothing is
pushed.
