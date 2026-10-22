# Pantry — manual step-to-ingredient linking — 2026-10-21

## His words

> [voice memo, 4:44 PM] "For the maple sea salt banana bread, I noticed that the maple
> syrup wasn't added to the steps. And I noticed also if you add more details to the
> steps, they don't update the ingredients below the steps for cook mode. So I know that
> when the recipe is added, and put into the format of the recipe, like imported. It
> makes those steps and combines the ingredients with the steps. How do we make it after
> the fact that it's imported when people want to either create their own recipe or edit
> a recipe and add an ingredient? How do we incorporate that into this setting? The
> steps. Like almost as if post production or post import."

> [tap answer, 4:47 PM, in reply to a "build an AI re-sync button" offer] "Let the user
> manually do it by selecting which ingredients to incoporate in which step. it should be
> selectable. when writing in a step"

> [tap answer, 4:49 PM] "Follow existing design system, no reference needed"

## Goal

While editing a step in the recipe editor, let him pick which ingredients that step
uses (tappable chips), stored explicitly per step. Cook Mode shows his explicit picks
for a step when he's set any; otherwise it keeps today's automatic text-matching
(`stepIngredientIndexes`) so nothing already working breaks. Applies to new recipes,
imported recipes, and hand-edits alike — no changes to the importer/parser.

## Done when

- `recipeShape.js` carries a new `stepIngredientLinks` field (object, step-index keys →
  arrays of ingredient indexes), sanitized defensively (drops out-of-range/malformed
  entries), defaults to `{}` — every recipe saved before today loads with no entries and
  behaves exactly as it does now.
- `RecipeEditor.jsx`: each step's textarea has a row of ingredient-name chips below it;
  tapping a chip toggles that ingredient for that step; chips reflect current selection
  state immediately; visually matches the app's existing chip pattern (the category
  chips already in this same file, `rounded-full border ... bg-peach` when active).
- **Reindexing correctness (the real risk in this build):**
  - Deleting a step (`removeStep`) or reordering steps (`moveStep`) in the editor keeps
    each remaining step's chip selections attached to the right step, live, not just
    after save.
  - Deleting an ingredient (`removeIngredient`) removes it from any step's selection and
    shifts every other step's stored ingredient indexes correctly, live.
  - On Save, `handleSave` already drops blank ingredient rows and blank instruction rows
    before writing to Firestore (`clean.ingredients`/`clean.instructions`) — confirm
    `stepIngredientLinks` is remapped through that same drop/reindex so saved links still
    point at the right ingredient/step after blanks are stripped, not stale indexes.
  - Test: build a recipe with 3 ingredients and 3 steps, link ingredient #2 to step #2,
    delete ingredient #1, delete step #1, verify (in Cook Mode after save) the link still
    shows the right ingredient under the right step.
- `RecipeDetail.jsx` Cook Mode: a step with an explicit link shows exactly those
  ingredients (filtered to ones with a name, same as today); a step with no explicit
  link falls back to `stepIngredientIndexes()` exactly as it does today, unchanged.
- `npm test`, `node scripts/check-jsx-imports.mjs`, `npm run build` all pass clean.
- Screenshot of the editor showing the per-step chip row (populated, at least one
  toggled on) at 390px width.
- Screenshot of Cook Mode showing one step using an explicit link and a different step
  (no explicit link set) still showing the auto text-match — side by side or two shots.

## Reference

none — follow Pantry's existing design system (chip pattern already in
`RecipeEditor.jsx`'s category picker; card/warm-cream tokens in `src/index.css`).

## Not doing

- AI "re-sync" button that rewrites step text via Claude — explicitly rejected by him in
  favor of manual selection.
- Always-auto-sync.
- Retroactively migrating/auto-linking his existing saved recipes — he retrofits them at
  his own pace by opening the editor; this build only has to not break them.
- Any change to the importer/parser (`api/_lib/recipe.js`).

## Tries

5

## Open questions

None — both open questions (selection mechanism, visual reference) were asked and
answered before this card was written.

## Result — 2026-10-21 (v1.34.0, local commit on main only, not pushed)

Built in 1 build-and-check try. Evidence: `/home/roni/agent/artifacts/pantry-step-links/`
(3 screenshots at 390x844, `click-through.mjs` + `click-through-output.txt`). Full report:
`/home/roni/agent/artifacts/build-20261021-165257-2624205.md`.

- [x] recipeShape field — PASS. `sanitizeRecipe` returns `stepIngredientLinks`, cleaned by
  `cleanStepLinks` (non-integer/out-of-range/negative/duplicate ingredient ids, bad step
  keys like "foo"/"01"/out-of-range, non-array lists, array-or-null whole field all
  dropped) and re-pointed past the empty steps sanitize already drops. Old recipe with no
  field -> `{}`. Unit tests: "old recipes and malformed links", "sanitize re-points links".
- [x] Editor chips — PASS. Chip row under every step textarea, one chip per named
  ingredient, same classes as the category chips (px-3 py-1 instead of px-4 py-2, so a
  7-ingredient row fits at 390px). Tap toggles live (aria-pressed checked in the browser).
  Until tapped, chips show the text-matched set (caption says so); first tap starts from
  that set, so tapping one extra ingredient doesn't wipe the matched ones. "Match from
  text" puts a step back on automatic. Screenshot `1-editor-step-chips.png`.
- [x] Reindexing, live — PASS. Browser (guest, `/new`, draft in localStorage): link
  maple syrup (#2) to step 2 -> `{"1":[1]}`; delete flour (#1) -> `{"1":[0]}`; delete step
  1 -> `{"0":[0]}`, chips show maple syrup ticked on "Mix everything together." (now step
  1); move it down -> `{"1":[0]}`, ticked chip moved with the step; reload -> restored via
  sanitizeRecipe, still right. Screenshot `3-new-recipe-after-deletes.png`.
- [x] Reindexing on Save — PASS (unit test). `handleSave` builds keep-maps for both lists
  (`keepMap`) and remaps through `remapStepLinks`; test "save drops blank rows..." covers a
  blank ingredient and blank step on both sides of linked ones plus a link to a dropped
  blank ingredient. `createRecipe` (explicit field list) now writes the field; edits go
  through `updateRecipe` as-is. Firestore rules have no field whitelist.
- [x] Card-scenario test — PASS. `tests/stepLinks.test.js` "card scenario": 3 ingredients
  + 3 steps, link #2 -> step #2, delete ingredient #1, delete step #1, save, then the Cook
  Mode resolution gives `['maple syrup']` under "Mix everything together." and nothing
  under "Bake". Mutation check: breaking the ingredient shift or the step renumber in
  stepLinks.js each makes this test fail (2 fails each), then restored to 28/28.
  NOT done: the same scenario saved to Firestore and opened in Cook Mode in the browser:
  guests can't save; needs his login (Home task card).
- [x] Cook Mode — PASS. Explicit link shows exactly those (named) ingredients; no link
  falls back to `stepIngredientIndexes`, unchanged (stepIngredients.js untouched).
  Pancakes with a route-injected link on step 3: step 2 auto (eggs, buttermilk, butter),
  step 3 explicit (flour, buttermilk). Screenshot `2-cookmode-explicit-and-auto.png`.
- [x] `npm test` 28/28, `node scripts/check-jsx-imports.mjs` exit 0, `npm run build`
  clean (no warnings). 0 pageerrors in the browser run.
- [x] APP_VERSION 1.33.3 -> 1.34.0 + dated CHANGELOG entry.

His words re-read: manual selection (chips), selectable while writing a step (under the
textarea, updates as he types), created + edited + imported (imports land in the same
`/new` editor via the draft, tested path) — all there. Not verified on a real iPhone or
with a real Firestore save.

## Revision — 2026-10-21 6:10pm: move chips off the step row into a popup

His words (voice memo): "In between the steps, I want to have the up arrow for
reordering. And then in between the arrows, I want there to be a link button or some
sort of button that indicates a pop-up screen that you'll link the ingredients to... so
you can space out the up and down arrow and we don't have a bunch of text in between or
buttons in between the steps." FEEDBACK.md entry added.

- [x] Inline chip row + caption removed from under the step textarea.
- [x] New icon button (`ListChecks`) inserted between the up/down reorder arrows — a
  small count badge (`bg-cta`) shows how many ingredients are linked, 0 = no badge.
  Button fills peach (`bg-peach`, same active styling as the category chips) when the
  step has a manual (not auto-matched) link, so manual vs. auto is visible without
  opening it.
- [x] Tapping it opens a popup (`StepIngredientPicker`, same modal pattern as
  `ConfirmDialog`/`AddToPantryPrompt`) with the same chip-toggle UI and "Match from
  text" reset, now inside the popup instead of inline. "Done" closes it.
- [x] All existing selection/reindex logic (`stepIngredientsFor`, `toggleStepIngredient`,
  `resetStepIngredients`, the reindex-on-delete/move/save paths) untouched — this was a
  presentation change only, confirmed by the same 28/28 `npm test` pass.
- [x] `npm test` 28/28, `node scripts/check-jsx-imports.mjs` exit 0, `npm run build`
  clean.
- [x] Screenshots: static mock built from the real compiled Tailwind CSS
  (`dist/assets/index-CGn1pPGl.css`) + the exact JSX markup/classes, at 390px — the
  real app route couldn't be screenshotted directly (guest mode can't reach `/new`'s
  "+" button — `guardWrite()` blocks it — and `/recipe/:id/edit`'s Edit button needs a
  real `user`, not just `guest`, per `isOwner` in RecipeDetail.jsx; same constraint the
  original build hit for its browser-based checks). Closed state (3 steps, badges 0/3/1)
  and the open popup (step 2, 3 picked) both confirmed visually correct against the
  spec and his description.
- [x] APP_VERSION 1.34.0 -> 1.34.1 + dated CHANGELOG entry.

Not verified: real click-through on-device (same gap as the original build — needs his
login, not something this session can do).

## Revision 2 — 2026-10-21 7:11pm: text field itself opens the combined popup

His words (voice memo): "keep the up arrow in the down arrow spaced where it is, and
remove that button and make it so if you tap on the text field or the free field text
for each step, it opens up that pop-up window that we showed all the ingredients to
choose to incorporate with, and editable field for the step, just so we can have it all
in one place." FEEDBACK.md entry added.

- [x] `ListChecks` icon button removed from between the arrows; up/down column back to
  its original two-button layout (no count badge either — it only existed on that
  button).
- [x] The step's textarea replaced with a `button` styled identically (`.input`,
  `line-clamp-2`, muted placeholder color when empty) that opens the popup on tap —
  actual text editing no longer happens inline, only inside the popup.
- [x] Popup (`StepEditor`, renamed from `StepIngredientPicker`) now has both: an
  editable `<textarea>` bound to that step's text (autofocus) and the same
  ingredient-chip picker below it, one "Done" button closes it. Typing in the popup
  calls the same `setStep` the old inline textarea called, so reindexing/save logic is
  untouched.
- [x] `npm test` 28/28 (unchanged — no logic touched, presentation only), `node
  scripts/check-jsx-imports.mjs` exit 0, `npm run build` clean.
- [x] Screenshot: same static-mock method (real compiled CSS + exact markup), 390px —
  closed state (plain two-arrow column, tappable text fields) and the open popup (step
  2's text editable, ingredients below it) both confirmed against his description.
- [x] APP_VERSION 1.34.1 -> 1.34.2 + dated CHANGELOG entry.

Not verified: real on-device click-through (same standing gap, needs his login).
