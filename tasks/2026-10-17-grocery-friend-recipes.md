# What Can I Make? — sort by match %, dedupe friend recipes

## Goal

On the Grocery tab's "What Can I Make?" results (`src/pages/GroceryList.jsx`
`WhatCanIMake`): sort both result sections by highest ingredient-match percentage
first (not raw ingredient count), with a visible sort control, and stop showing the
same underlying recipe multiple times in "From your friends" just because several
friends each still have their own copy of it.

## Context

Voice memo (2026-10-17 7:34pm) + screenshot
(`/home/roni/agent/bridge/run/photos/jatbot--1004427257155_0-1792286997470-IMG_0815.png`)
showing "Fluffy Buttermilk Pancakes by Hannah Hogencamp" repeated twice under "FROM
YOUR FRIENDS" with the same "2/7 ingredients (29%)" line both times.

Likely root cause of the duplication: `src/lib/firestore.js` `seedIfEmpty()` gives
every new user their own private copy of `src/data/sampleRecipes.js`'s starter
recipes (fresh doc id each time, no shared key). `WhatCanIMake`'s `useEffect`
(`GroceryList.jsx` ~line 206) calls `getFriendRecipes(id)` for every friend and
concatenates the results — so any starter recipe none of your friends has deleted
shows up once per friend who still has it. `seedIfEmpty`'s own comment says starter
recipes should be credited to "Pantry", not the user, specifically so this doesn't
look like a friend's real recipe — but the screenshot shows a real name
("Hannah Hogencamp"), so either that crediting isn't actually happening, or this is
an older doc seeded before that fix existed. Investigate and fix/note which, don't
just paper over the symptom.

## Done when

- `WhatCanIMake`'s two result sections ("From your library", "From your friends")
  sort by ingredient-match percentage (have/total), highest first — not raw `have`
  count as today (`rankByPantry`'s current `.sort((a,b) => b.have - a.have ...)`).
- A visible sort control exists on the results (he asked for "a button") — simplest
  defensible version: a toggle between "Best match %" (default) and "Most
  ingredients" count, or just a clearly-labeled single best-match sort if a second
  mode doesn't add real value. Use judgment, don't overbuild.
- "From your friends" never shows the same underlying recipe more than once, even
  when multiple friends each have their own copy of it (content-based dedup: same
  normalized title + same ingredient-name set = same recipe, keep one). Verify with
  a real multi-friend account state that reproduces today's duplicate (or construct
  one), not just by reading the code.
- Investigate and either fix or document the "by Hannah Hogencamp" byline — starter
  recipes are supposed to show "by Pantry" per `seedIfEmpty`'s existing comment.
- `npm run build` succeeds, no new console warnings.
- APP_VERSION bumped + CHANGELOG entry (standing rule).
- No regression to "From your library" (non-friend) results, or to the existing
  ingredient-pill search / Find Recipes flow.

## Not doing

- Not touching the Friends tab itself (`src/pages/Friends.jsx`) or how friends are
  added/removed.
- Not changing the starter-recipe seeding mechanism itself (`seedIfEmpty`) beyond
  what's needed to fix the byline bug, if it is one — not re-architecting how new
  users get starter recipes.
- Not deduping "From your library" (that's always just the signed-in user's own
  recipes — no cross-user duplication possible there).

## Decided

- Dedup key: content-based (normalized title + ingredient-name set), since existing
  seeded docs have no shared id to key off of. If useful, also add a stable origin
  key going forward for exact future matching — judgment call, not required.
- He explicitly left the "how" of dedup up to us ("I don't know how you'll do that
  ... makes sense") — no need to re-ask the mechanism.

## Tries

5
