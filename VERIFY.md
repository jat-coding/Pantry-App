# VERIFY.md — Pantry-App

How to check work on this project for real.

## Build

- `npm run build` (Vite) must succeed with no new console errors/warnings.
- No test runner exists in this project yet (no `test` script in package.json) — don't
  claim test coverage; a task card's "Done when" checks are the verification until one
  is added.

## Run locally

- `npm run dev` — Vite dev server. Check `vite.config.js` / terminal output for the
  actual port each run (not fixed across sessions); report both the Mac/desktop-local
  URL and the Tailscale URL for any "done" local-preview report (standing rule).
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

## Screens/data that matter for most feature work

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
