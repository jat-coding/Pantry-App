# Pantry PDF preview: dead space below the Close/Share bar — 2026-10-17 8:10pm

Project: `/home/roni/agent/projects/Pantry-App`. Read
`src/components/PdfPreview.jsx` (the new full-screen preview from v1.25.0) and how it's
mounted in `src/pages/RecipeDetail.jsx` (~line 472, rendered inline as a child of that
page's root `<div className="animate-fadein ...">`, NOT a portal to `document.body`).
LOOK at his screenshot:
`/home/roni/agent/bridge/run/photos/jatbot--1004427257155_0-1792289368810-IMG_0818.png`
— on his phone there's visible empty space below the "Close / Share" button bar, down
to the real bottom of the screen; he wants that bar to sit flush at the true bottom,
no gap below it.

## Investigate before fixing

`PdfPreview` is `position: fixed; inset: 0` with `animate-fadein` on itself, and it's
rendered as a descendant of `RecipeDetail`'s own root div, which ALSO has
`animate-fadein`. `fadein` (see `tailwind.config.js`) animates `transform:
translateY(...)` — and a CSS element with any non-`none` computed `transform` becomes a
new containing block for its `position: fixed` descendants (this is a real, documented
CSS behavior, not a guess — verify it applies here before using it as the fix
rationale). If `RecipeDetail`'s root div's `animate-fadein` is still influencing layout
when the modal mounts (or any other ancestor of `PdfPreview` has a transform/filter/
will-change for any reason), `PdfPreview`'s `fixed inset-0` would be sized against that
ancestor's box instead of the true viewport, which would explain a mismatch between the
"fixed to screen" bar and the real bottom edge.

Confirm this (or rule it out and find the real cause) by actually inspecting computed
layout, not by guessing — the project's own history today had a theory-that-turned-out-
wrong (the recipe-PDF photo CORS theory) cost real build time; look before fixing here.
Other real candidates worth checking: iOS visual-viewport vs. layout-viewport mismatch
with the on-screen keyboard/home-indicator; whether `useScrollLock` (used by this
component) is doing something to body height/position that affects the fixed
descendant's containing block.

## Fix

Whatever the actual cause, the end result must be: `PdfPreview`'s outer `fixed inset-0`
container, and the Close/Share bar inside it, sit flush against the TRUE device
viewport edges with no gap below the button row (down to the home indicator / safe
area, same as other full-screen overlays in this app already handle correctly — check
how e.g. Cook Mode's fixed bars or other full-screen modals in this codebase avoid this
problem, if any do, and match that pattern). The likely clean fix if the transform-
containing-block theory confirms: render `PdfPreview` via a React portal to
`document.body` (`createPortal`) instead of inline in `RecipeDetail`'s tree, so it's
never a descendant of anything with a transform. Don't just guess at padding/margin
numbers to visually paper over a containing-block bug — fix the actual cause.

## Verify

- On an iOS-sized viewport (390x844 or similar), the Close/Share bar sits at the true
  bottom of the screen with no visible empty space below it, with and without the
  `env(safe-area-inset-bottom)` value simulated.
- No regression to the preview's scrollable content area or header.
- `npm run build` succeeds, no new console warnings.
- Bump `APP_VERSION` + `CHANGELOG` entry (standing rule).

## Do not

Don't push — commit locally only, he says when (standing rule). Don't touch the PDF
template/layout itself or the snake-flow pagination — this is purely the preview
modal's positioning.

## Deliver

Start your output file with a "## Summary" block (TL;DR / What I found / Need from
you, plain language, under ~2,500 characters, no em dashes): state the actual
confirmed root cause (not a guess) and how you verified the fix closes the gap.
