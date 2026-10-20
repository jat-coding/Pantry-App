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
