# FEEDBACK.md — Pantry-App

One entry per send-back: what he asked for, what came back wrong, and the check that
now catches it.

## 2026-10-17 — Recipe PDF share (v1.22.0)

Task card: `tasks/2026-10-17-recipe-pdf-share.md`.

**What he asked for:** share/PDF button on a recipe's detail page, matching a reference
card layout (photo, title, stats, ingredients/method, note).

**What came back wrong** (reported after a real on-device test of the pushed/deployed
build):
1. The recipe photo doesn't appear in the generated PDF, even for recipes that have one.
2. A recipe with a long method list gets squeezed onto the single page instead of
   flowing onto a second PDF page — content should paginate, not shrink/clip.

**Checks that would have caught it** (added to VERIFY.md):
- Generate a PDF for a recipe that has a real Firebase-Storage photo and open the
  resulting PDF file — the photo must actually render, not just "the code path that
  loads it didn't throw."
- Generate a PDF for a recipe with a long instructions list (15+ steps) and confirm the
  method text is not clipped/overlapping and continues onto a second page.

## 2026-10-19 — oz -> cup/tbsp/tsp only covered fluid ounces (v1.26.0)

Task cards: `tasks/2026-10-19-recipe-card-cookmode-units.md` (original),
`tasks/2026-10-19-weight-oz-density-conversion.md` (correction, v1.32.0).

**What he asked for:** "Allow the user to convert oz into cups and teaspoons
tablespoons. Those should be default and rounded to the nearest half unit."

**What came back wrong:** only "fl oz" ingredients converted. The card put weight oz in
"Not doing", so his cookie recipe in Cook Mode (butter, brown sugar, flour, baking soda,
salt, vanilla paste, molasses, all weight oz) still only offered g/kg/oz/lb.

**Checks that would have caught it** (added to VERIFY.md, Ingredient units section):
- A weighed baking staple must offer and default to cup/tbsp/tsp; an unknown weighed
  ingredient must stay weight-only.
- Don't narrow his literal instruction in "Not doing" without asking: "oz" meant all oz.

## 2026-10-21 — List-view title still unreadable after "wrap, not truncate" (v1.33.1)

Task card: `tasks/2026-10-21-list-view-remove-category-pills.md`.

**What he asked for (10/20):** titles get priority in list view, wrap instead of
truncate, time moves to the far right (v1.33.1, commit 37c8bba).

**What came back wrong** (photo, 10/21): `line-clamp-2` was added, but the fixed-width
`w-24` category-pills column still eats ~96px+gap out of the row, so a longer title
("Maple Sea Salt...") still clips to "Maple / Sea Salt..." across its 2 allowed lines.
Wrapping alone didn't fix it — the row still doesn't have enough width for the title.
His follow-up: "Remove the little pills for their categories so you can have more space
for the title. We still can't read the title of the recipes."

**Check that would have caught it** (added to VERIFY.md): a recipe-list visual check
must use a genuinely long real title (not a short test fixture) and confirm it reads in
full within 2 lines at 390px width before calling a list-row layout change done.

## 2026-10-21 — Step-ingredient chips too much clutter in the editor (v1.34.0)

Task card: `tasks/2026-10-21-step-ingredient-linking.md`.

**What he asked for (4:47pm):** manual per-step ingredient selection, "selectable, when
writing in a step."

**What came back wrong** (voice memo, 6:10pm, after trying it): v1.34.0 put a full
always-visible row of ingredient-name chips plus a helper sentence under every single
step's textarea. His words: "space out the up and down arrow and we don't have a bunch
of text in between or buttons in between the steps." The selection mechanism itself
(tap a chip to toggle) was right — the problem was always-visible inline chips eating
space between every step.

**Fixed same day:** chips moved into a popup, opened by one icon button (`ListChecks`,
with a small count badge) inserted between the step's up/down reorder arrows — exactly
where he asked for it, and it visually spaces the arrows apart as a side effect. Nothing
sits between steps anymore except the up/down/link/remove button column.

**Check that would have caught it** (added to VERIFY.md): any per-item inline control
row (chips, extra buttons, helper text) added under a repeating list item should default
to a popup/modal unless he explicitly asked for it inline — ask, don't assume inline is
fine just because the selection logic itself works.

## 2026-10-21 — Second round: one popup button was still one tap too many (v1.34.1 -> v1.34.2)

Task card: `tasks/2026-10-21-step-ingredient-linking.md`.

**What came back wrong** (voice memo, 7:11pm, right after seeing v1.34.1's icon button):
"keep the up arrow in the down arrow spaced where it is, and remove that button and
make it so if you tap on the text field... it opens up that pop-up window that we
showed all the ingredients to choose to incorporate with, and editable field for the
step, just so we can have it all in one place." The dedicated `ListChecks` button
between the arrows was itself extra UI — he wanted the step's own text field to be the
single entry point into a combined edit-text + pick-ingredients popup.

**Check that would have caught it** (added to VERIFY.md): when a task's own goal is
"fewer controls/less clutter," don't stop at the first simplification that technically
adds a new control (even a small icon button) — ask whether an existing element (here,
the step text itself) can be the single tap target before adding a new one.

## 2026-10-21 — Cup-vs-tbsp/tsp threshold was "close to a fraction," not the real amount (v1.32.0 -> v1.34.4)

Original task: `tasks/2026-10-19-weight-oz-density-conversion.md`.

**What came back wrong** (voice memo): "teaspoons and tablespoons were picked up before
one fourth cups or one third cups. Anything lower than one fourth cup should be
labeled as defaulted as teaspoons or tablespoons. Otherwise, one fourth cup should be
prioritized, with one third cup." `defaultUnitFor` in `src/lib/scaling.js` had a
`SMALL_CUP_TOLERANCE_TSP = 1` guard that only showed a 1/4-1/2 cup reading as cup if it
landed within 1 tsp of an exact 1/4 or 1/3 cup fraction — so e.g. 3 fl oz (genuinely
0.375 cup, 6 tbsp) stayed in tbsp because it was 2 tsp off the nearest fraction (1/3
cup), even though it's well above the 1/4 cup line he wants as the actual cutoff.

**Check that would have caught it** (added to VERIFY.md): the cup-vs-tbsp/tsp default
is a single threshold on the real quantity (>= 1/4 cup = cup, below = tbsp/tsp), not a
"how close is it to a round fraction" tolerance — test an amount that's meaningfully
above 1/4 cup but not near any exact 1/4 or 1/3 landmark (like 3 fl oz / 0.375 cup) and
confirm it still shows as cup.
