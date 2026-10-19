# Pantry "What Can I Make?" — sort by % match, dedupe friend recipes — 2026-10-17

Project: `/home/roni/agent/projects/Pantry-App`. Read
`tasks/2026-10-17-grocery-friend-recipes.md` (full spec) first, then
`src/pages/GroceryList.jsx` (the `WhatCanIMake` component and `rankByPantry`),
`src/lib/firestore.js` (`seedIfEmpty`, `getFriendRecipes`), and
`src/data/sampleRecipes.js`. LOOK at the screenshot he sent:
`/home/roni/agent/bridge/run/photos/jatbot--1004427257155_0-1792286997470-IMG_0815.png`
— it shows "Fluffy Buttermilk Pancakes by Hannah Hogencamp" repeated twice under
"FROM YOUR FRIENDS" with the identical "2/7 ingredients (29%)" line both times.

## Three things to build/fix

1. **Sort by match percentage, not raw count.** `rankByPantry()` in
   `GroceryList.jsx` currently sorts `.sort((a,b) => b.have - a.have || a.missing -
   b.missing)` — raw ingredient count, so a recipe where you have 5/20 ingredients
   can outrank one where you have 4/4 (100%). Change the primary sort to
   `have/total` descending. Add a visible sort control on the results (he explicitly
   asked for "a button") — use your judgment on the simplest version that's
   genuinely useful (e.g. a toggle between "Best match %" default and "Most
   ingredients"); don't overbuild a multi-option filter panel he didn't ask for.
   Apply to both the "From your library" and "From your friends" sections.

2. **Dedupe repeated friend recipes.** `WhatCanIMake`'s `useEffect` loops every
   friend id and concatenates `getFriendRecipes(id)` results into one `friendRecipes`
   array with no dedup. Root cause to confirm: `seedIfEmpty()` in `firestore.js`
   gives every new user their own private Firestore doc of each
   `sampleRecipes.js` starter recipe (`doc(recipesCol)` — a fresh random id,
   nothing shared), so any starter recipe that multiple friends still have shows up
   once per friend. Fix: dedupe the merged `friendRecipes` list by a content-based
   key (normalized title + sorted ingredient-name set) before ranking, keeping one
   representative per unique recipe. This must actually eliminate visible duplicate
   cards in the UI, not just theoretically reduce a count — verify by constructing a
   test case (e.g. two "friend" accounts/doc fixtures with the same starter recipe)
   and confirming only one card renders.

3. **"by Hannah Hogencamp" byline investigation.** `seedIfEmpty()`'s own comment
   says starter recipes are credited to `authorName: 'Pantry'` specifically so they
   don't look like a friend's own recipe. The screenshot shows a real name instead.
   Find out why: is this an old doc seeded before that crediting logic existed (in
   which case say so and leave it — not worth a destructive migration for display
   text), or is there a live bug where some path still sets a real authorName on a
   starter recipe? If it's the latter, fix it. If you can't tell without live
   Firestore data this machine doesn't have credentials for, say exactly what you
   checked and what you couldn't verify — don't guess.

## Scope

Everything else in `GroceryList.jsx`/`WhatCanIMake` (the ingredient-pill search
input, `Find Recipes` button, `copyToPantry`) stays as-is. Don't touch
`Friends.jsx` or the seeding mechanism itself beyond the byline investigation above.

## Verify

- `npm run build` succeeds, no new console warnings.
- Manual/constructed test: a mix of recipes with different `have/total` ratios
  sorts with the highest percentage first, in both sections.
- Manual/constructed test: multiple "friends" each holding an identical starter
  recipe renders as ONE card in "From your friends", not one per friend.
- Existing single-friend, no-duplicate case is unchanged (no regression).
- Bump `APP_VERSION` in `src/lib/version.js` + add a `CHANGELOG` entry (standing
  rule, every commit).

## Do not

Don't push or deploy — commit locally only, he says when (standing rule).

## Deliver

Start your output file with a "## Summary" block (TL;DR / What I found / Need from
you, plain language, under ~2,500 characters, no em dashes): say what you built for
each of the 3 items above, the byline investigation's actual finding (not a guess),
and pass/fail for each verify check with how you confirmed it.
