# Pantry recipe-PDF: in-app preview before sharing — 2026-10-17 7:50pm

Project: `/home/roni/agent/projects/Pantry-App`. Read
`tasks/2026-10-17-recipe-pdf-share.md` (full history, esp. "New: in-app PDF preview
before sharing" at the bottom) and `src/pages/RecipeDetail.jsx`'s `sharePdf()`
function (~line 179) first. This runs after a separate snake-flow/stat-banner layout
job on the same feature — pull/check `git log` before starting so you're building on
top of its commit, not an older one.

## What to build

Today tapping the Share icon on a recipe builds the PDF then calls
`navigator.share({ files: [file] })` straight away — no way to see the PDF first. He
wants: tap Share → the PDF opens in an in-app preview (so he can see the formatting) →
a Share button inside that preview does the actual share/download, same as today's
behavior but one step later.

Implementation approach: keep `sharePdf()`'s PDF-building/caching logic (`readyPdf`
cache keyed on `[recipe, factor, units]` — a second open must reuse the cached file,
not rebuild). Instead of calling `navigator.share` immediately after building, open an
in-app modal/overlay that renders the PDF (an `<iframe>` or `<object>` pointing at a
blob URL from the file works in iOS Safari/PWA; verify it actually renders there, not
just in desktop Chrome) with a visible "Share" button. That button's own tap handler
calls `navigator.share({ files: [file], title: recipe.title })` (or the existing
download fallback for devices without file-share support) — this is itself a fresh
user-gesture tap, so it satisfies the same iOS requirement the current code already
works around (see the comment above `sharing`/`readyPdf` state). Give the modal a close
button that discards the preview without sharing.

Match the app's existing modal/overlay patterns (check how other full-screen overlays
in this app are built, e.g. `ConfirmDialog.jsx` or similar) rather than inventing a new
pattern.

## Verify

- Tapping Share opens an in-app preview of the actual generated PDF, legible, matching
  what would be shared.
- The preview's Share button triggers the real share sheet (or download fallback) with
  the same file shown in the preview.
- A second share attempt (same recipe/view) reuses the cached PDF — doesn't rebuild.
- Changing scaling/units before sharing produces a correctly updated preview (the
  existing `readyPdf` cache-invalidation-on-view-change logic still works).
- Closing the preview without sharing doesn't error or leave a stuck loading state.
- `npm run build` succeeds, no new console warnings.
- Bump `APP_VERSION` + `CHANGELOG` entry (standing rule).

## Do not

Don't push or deploy — commit locally only, he says when. Don't touch the PDF template/
layout itself (that's the other job's scope) — this is purely the share-flow UI.

## Deliver

Start your output file with a "## Summary" block (TL;DR / What I found / Need from
you, plain language, under ~2,500 characters, no em dashes): describe what the preview
looks like/how it was verified (can't fully exercise iOS Safari's native share sheet
from this machine — say exactly what you could and couldn't check), and pass/fail for
each verify item above.
