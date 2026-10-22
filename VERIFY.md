# VERIFY.md — Pantry-App

How to check work on this project for real.

## Build

- `npm run build` (Vite) must succeed with no new console errors/warnings. **Vite/esbuild
  does not catch a component used in JSX with no import** (confirmed 2026-09-19: v1.17.1
  shipped to prod with `RecipeCard` using `SafeImage` with no import, crashing live for
  him, and a clean `npm run build` the whole time). Before any push: `node
  scripts/check-jsx-imports.mjs` must also pass (exit 0) -- it flags exactly that class of
  bug. It's a regex-based stopgap, not a real parser (no ESLint dependency in this repo
  yet); false positives are possible on an unusual pattern, but it has zero on the real
  `src/` tree as of 2026-10-20.
- Any scripted multi-file edit (a sed/python replace run across several files, not a
  hand-edit) should run through `scripts/assert-edit-hash.sh <file...> -- <command...>`
  (repo root) -- it asserts each named file's content actually changed, catching a no-op
  substitution whose pattern silently matched nothing (the other half of the 2026-09-19
  incident: the scripted import-replace's own assert only checked the new name appeared
  somewhere, which was already true from an unrelated import).
- `npm test` (node:test, `tests/*.test.js`, added 2026-10-19) covers the unit conversion
  logic in `src/lib/scaling.js` and the JSX-import checker itself
  (`tests/check-jsx-imports.test.js`, added 2026-10-20), and the step -> ingredient link
  re-pointing in `src/lib/stepLinks.js` (`tests/stepLinks.test.js`, added 2026-10-21).
  Nothing else has test coverage —
  don't claim it does; a task card's "Done when" checks are the verification for everything
  else.

## Run locally

- `npm run dev` — Vite dev server. Check `vite.config.js` / terminal output for the
  actual port each run (not fixed across sessions); report both the Mac/desktop-local
  URL and the Tailscale URL for any "done" local-preview report (standing rule).
- **Fixed 2026-10-21**: a real `.env` now exists on this machine (desktop), pulled from
  the live production JS bundle — the six `VITE_FIREBASE_*` values are public
  client-side config (not secret; Vercel's own env store marks them "sensitive"
  write-only, so they can't be read back via API, but they're already shipped in every
  visitor's browser). The standing dev/preview server at `:8091` now actually mounts
  instead of white-screening on `auth/invalid-api-key`. If `.env` goes missing again
  (new machine, wiped worktree), re-pull it: `curl` the prod `index.html`, grab the
  `/assets/index-*.js` hash, `grep -oE '(apiKey|authDomain|projectId|storageBucket
  |messagingSenderId|appId):"[^"]*"' bundle.js`. `ANTHROPIC_API_KEY` is NOT in `.env` —
  that one's a real secret, not needed just to render the UI; recipe-import parsing
  will fail gracefully without it, same as before.
- Still true for anything that needs a before-2026-10-21 state check: the HTTP 200
  from the dev server was never proof the app mounted — always confirm Firebase
  actually initializes (screenshot or `page.on('pageerror')`), don't just check the
  status code.
- Client app only — Firebase (auth/data) + `/api/*` Vercel serverless functions
  (recipe-extraction AI, etc.) are the two moving parts; most UI work only touches the
  client.

## Deploy

- Production: `git push origin main` → Vercel auto-deploys from `origin/main` to
  pantry-app-nu-nine.vercel.app. Never push without his explicit go-ahead (standing
  rule — he says when).
- Verify a prod push landed by curling the deployed JS bundle for the new version
  string / changed text, not by trusting the push succeeded silently.

## Every commit

- Bump `APP_VERSION` in `src/lib/version.js` and add a dated `CHANGELOG` entry in
  user-facing language (standing rule, no exceptions).
- Any new per-item inline control (chips, extra buttons, helper text) added under a
  repeating list row (a recipe step, an ingredient row, etc.) defaults to a popup/modal
  behind one icon button, not an always-visible row — he said so explicitly 2026-10-21
  after v1.34.0 shipped inline step-ingredient chips he called clutter. Ask first if a
  task seems to call for genuinely inline controls.
- When the goal is explicitly "fewer controls/less clutter," prefer making an existing
  element (a text field, a row) the tap target into a combined popup over adding a new
  dedicated button for it, even a small icon one — 2026-10-21, a `ListChecks` button
  added between a step's arrows was itself judged one control too many a round later.

## Screens/data that matter for most feature work

- Any full-bleed header image (a hero photo meant to reach the top of the screen) must
  cancel `main`'s safe-area-aware top padding (`Layout.jsx`'s
  `pt-[calc(env(safe-area-inset-top)+1.25rem)]`) with the matching negative margin, not
  just a flat `-mt-5` — a flat value leaves a cream gap above the image exactly the
  height of the notch/status-bar inset on a real phone, invisible in a desktop/headless
  browser where that inset is 0 (RecipeDetail's hero, fixed 2026-10-21). Any absolutely
  positioned buttons over that image need the same inset added to their top offset so
  they don't end up under the status bar.
- Recipe Detail (`src/pages/RecipeDetail.jsx`) — the most-touched page: Cook Mode,
  ingredient scaling/unit switching, add-to-grocery, edit/delete all live here and are
  easy to regress with an unrelated change.
- A recipe with no image, no video, and a short ingredient/instruction list (edge case:
  nothing breaks on minimal data).
- A recipe whose image went through `src/lib/imageSnapshot.js` (Firebase Storage URL)
  vs. one that hasn't (raw source URL) — different CORS behavior for anything that reads
  pixels off an `<img>` (canvas, html2canvas, etc.).
- iPhone viewport width (390px) — this is a phone-first app; also sanity-check desktop
  width since there's a sidebar layout at `sm:` breakpoint.

## Recipe PDF export (`src/lib/recipePdf.jsx`) — added after a 2026-10-17 send-back

- Generate a PDF for a recipe that has a real Firebase-Storage photo (not just a recipe
  with no image) and actually open the output file — confirm the photo renders, not just
  that `loadPhoto()` didn't throw.
- Generate a PDF for a recipe with a long instructions list (15+ steps) and confirm the
  method text isn't clipped/overlapping and flows onto a second PDF page rather than
  being squeezed onto one.

## Ingredient units / conversion (`src/lib/scaling.js`) — added after a 2026-10-19 send-back

- A weight-unit (oz/g/lb) ingredient with a recognizable name (butter, flour, sugar,
  baking soda, salt...) must offer and default to cup/tbsp/tsp on Recipe Detail and in
  Cook Mode. Check a real cookie-style recipe, not just a liquid one: v1.26.0 only
  handled fl oz and left the common case (weighed baking staples) on g/kg/oz/lb.
- An unrecognized weighed ingredient (e.g. banana) must stay weight-only — no guessed
  conversion.
- Run `npm test` after any change to scaling.js; add a case for the new behavior.
- Read his original instruction literally before scoping something out in "Not doing":
  if he said "oz", that means every oz, not only the subset that's easy.

## Recipe list-view row layout (`src/pages/Pantry.jsx`, `RecipeListView`) — added after a 2026-10-21 send-back

- Any list-row layout change must be checked against a genuinely long real recipe title
  (not a short test fixture) at 390px width, and the full title must read within its
  allotted lines — wrapping/line-clamp alone doesn't fix a title that's unreadable if a
  fixed-width sibling column (category pills, etc.) is still eating most of the row.

## Step -> ingredient links (`stepIngredientLinks`, `src/lib/stepLinks.js`) — added 2026-10-21 (v1.34.0)

- `stepIngredientLinks` is keyed by step position and holds ingredient positions. Any new
  code that removes, reorders, inserts mid-list, filters or merges `ingredients` or
  `instructions` (editor, save, `sanitizeRecipe`, an importer reshaping a saved recipe, a
  migration) must re-point it through `stepLinks.js` (`remapStepLinks` + `keepMap`, or the
  `linksAfter*` helpers), and get a case in `tests/stepLinks.test.js`. A screenshot of the
  happy path will not catch a stale index: the wrong ingredient just shows under a step.
- `createRecipe` in `src/lib/firestore.js` writes an explicit field list: a new recipe
  field must be added there too or new recipes silently drop it (edits don't, since
  `updateRecipe` passes the object through). Check both create and edit paths.
- Cook Mode check: one step with explicit picks shows exactly those; a step without picks
  still shows the text-matched ingredients (`stepIngredientIndexes`, unchanged).
- Browser click-through without a login: Browse as Guest, then client-side navigate
  (`history.pushState` + `popstate`) to `/recipe/guest-0/edit` or `/new`. Guests can't
  save to Firestore; `/new` autosaves the form to `localStorage['pantry-draft-new']`, which
  is the readable proof of what Save would send. Script used:
  `/home/roni/agent/artifacts/pantry-step-links/click-through.mjs`.
