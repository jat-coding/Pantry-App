# Social feed: dedicated Post composer (photo first, then link a recipe)

## His words (verbatim, in order)

> "There needs to be a post button for the feed and you are prompted to take an image or
> use an image and then link the recipe to the image before posting. The linking of the
> recipe should look at your recipes in a search view that first categorizes then you can
> filter through search."

> "There should be a refresh to see your posted up to date feed" (already built and
> shipped locally as part of the incident fix, v1.38.2 -- see
> `research/pantry-image-loss-incident-result-2026-11-08.md`. Not this card's job, just
> don't regress it.)

Tap answers, in order:
1. "Does the photo you take/pick at post time become the recipe's own saved photo, or
   stay specific to just that post?" → **Stays specific to that post** (the linked
   recipe's own `imageUrl` is never touched by posting).
2. "Can you post the same recipe more than once over time, each its own feed entry — or
   just one feed slot per recipe?" → **Separate entry every time you post.**
3. "Does this new Post button replace the 'Post to Social' toggle on a recipe's own
   page, or do both stay?" → **Replace it — one way to post.**

## This supersedes part of the original card

`tasks/2026-11-08-social-feed.md` (v1.38.0/v1.38.1, already live) built posting as a flag
+ timestamp on the recipe itself (`postedToFeed`/`postedAt`/`imageUrlCompressed`), with
at most one live post per recipe. Tap answers 1 and 2 above are incompatible with that:
a post now needs its own photo independent of the recipe, and a recipe can have several
posts over time. **A post is now its own thing, not a flag on a recipe.** No data to
migrate -- billing was down the whole time posting was live tonight, so no real post
with a working photo exists yet; it's fine to stop writing `postedToFeed`/`postedAt` on
recipes going forward rather than migrating them.

## Data model

New top-level `posts` collection (or `recipes/{id}/posts` subcollection -- pick whichever
is simpler given how `getFeedPosts` already queries per-friend; a top-level collection
with `authorId` probably mirrors `recipes` more closely and needs less rule duplication,
but use your judgment and say which you picked and why):

```
{ id, authorId, authorName, recipeId, recipeTitle, imageUrl, postedAt }
```

- `imageUrl`: the photo chosen/taken AT POST TIME, uploaded fresh to the author's own
  Storage folder (reuse the existing decode/downscale/encode path in `image.js`, same
  budget as a recipe photo upload -- don't reinvent it). Independent of the linked
  recipe's own `imageUrl`.
- `recipeId`/`recipeTitle`: which of the author's own recipes this post links to. Tapping
  the post opens that real Recipe Detail page (same as today).
- Still subject to the existing 30-day feed expiry (now per-post, not per-recipe) and the
  existing duplicate-check-on-copy (still against the LINKED recipe's ingredients, not
  the post's photo -- unchanged logic from `findLikelyDuplicate`/`socialFeed.js`, just
  called with the recipe the post points to).
- Copying from a post still copies the RECIPE (full ingredients/instructions, the
  recipe's own stored photo) into the copier's pantry -- same `pocketRecipe` flow as
  today. It does NOT copy the post's one-off photo; that photo only ever exists
  attached to the post in the feed, per tap answer 1. Rework `copyFeedPost`/`forkImage`
  usage accordingly: the thing being pocketed is still `recipeId`'s full recipe doc,
  fetched fresh if `handleFeedCopy` doesn't already have it.

## Expiry rework

Move `planExpiry`/`expireMyOldPosts`/`liveFeedPosts`/`isPostExpired` (socialFeed.js +
firestore.js) from operating on `recipes` to operating on `posts`: a post older than 30
days stops appearing in the feed and its own (now post-owned) full-res photo file gets
deleted -- there is no "permanent compressed record" question anymore for the post's
photo (tap answer 1 removed that; the photo belonged only to the post, not to any
permanent profile record), so this is actually SIMPLER than today's recipe-flag version:
no `imageUrlCompressed`, no "repoint `imageUrl`" step, no old-copy-keeps-the-photo
special case (that whole v1.38.1 fix was for recipe photos surviving via old-style
pantry copies -- irrelevant now that posts don't drive any recipe's own `imageUrl`).
Just: past 30 days -> delete the post doc (or flag it gone) and delete its photo file,
once no other post still points at that exact file (re-posting the same photo twice
should not double-delete).

## Post composer flow (new UI)

1. A Post button on the Social tab's Feed section (the report that shipped tonight
   didn't have one -- check what's there now and add it; follow this app's existing
   floating/primary-action button conventions, e.g. the bottom-bar `+` button pattern in
   `Layout.jsx`, for visual consistency -- don't invent a new button style).
2. Tap it -> prompted to take a photo or choose one from the library (standard
   `<input type="file" accept="image/*" capture="environment">`-style picker; this app's
   recipe-photo-field editor already has this exact pattern somewhere -- reuse it, don't
   rebuild photo-picking from scratch).
3. After a photo is chosen -> a recipe-picker view: **categorized first** (group the
   author's own recipes by category, same `CATEGORIES`/`primaryCategory` grouping
   `Pantry.jsx`/`FriendProfile` already use), **then filterable by a search box** on top
   (filter by title across all categories once typing starts -- same spirit as the
   existing friend-search-as-you-type debounce in `Friends.jsx`, reuse that pattern's
   timing, don't need a server round trip since this is the user's own already-loaded
   `recipes` from `useData()`). Tapping a recipe selects it.
4. Confirm/Post -> uploads the photo, creates the post doc, closes the composer, and the
   new post appears at the top of the Feed (use the refresh mechanism already shipped
   rather than a second parallel code path).
5. Remove the old "Post to Social"/"Remove from Social" toggle and "Posted Nd ago" text
   from Recipe Detail (`RecipeDetail.jsx`) -- tap answer 3. If removing it leaves an
   orphaned `postRecipeToFeed`/`unpostRecipeFromFeed` import or dead code, clean it up,
   don't leave it unreachable.

## Not doing

- No editing/deleting a post after it's posted (he didn't ask for it -- if he wants it,
  that's a future send-back, not an assumption to build now).
- No caption/text field on a post -- he described a photo + linked recipe, nothing else.
- No change to who can see the feed (still friends-only, same as today).

## Reference

None given.

## Done when

- `npm run build` clean, `node scripts/check-jsx-imports.mjs` passes, `npm test` green.
- Posting: tap Post -> choose/take a photo -> pick a recipe via the categorized/
  searchable picker -> post appears at the top of the Feed (via refresh) with that exact
  photo, the recipe's title, and opens the real recipe on tap.
- The SAME recipe posted twice (two different photos, two different times) shows as TWO
  separate feed entries, each with its own photo and its own "posted Xd ago".
- Posting a new photo for a recipe does not change that recipe's own stored photo
  anywhere else in the app (My Pantry, Recipe Detail, a friend's pantry view all still
  show the recipe's original photo, unchanged).
- Recipe Detail no longer has a "Post to Social" control.
- Copying from a feed post still lands the full recipe (ingredients/instructions, the
  recipe's OWN photo, not the post's photo) in the copier's pantry, with the existing
  duplicate-check-then-confirm gate unchanged.
- A post older than 30 days (simulate via a backdated `postedAt` fixture) drops off the
  feed and its photo file is reclaimed (not double-deleted if two posts shared one
  photo).
- Existing v1.38.2 behavior (avatar fallback-to-initial, feed refresh button) still
  works -- don't regress it while reworking the feed's data source.

## Tries

5

## Open questions

None -- resolved by the tap answers above. Collection shape (top-level `posts` vs. a
`recipes/{id}/posts` subcollection) is the build's judgment call; say which and why in
the report.

## Result (2026-11-08, v1.39.0, committed locally, NOT pushed, rules NOT deployed)

Collection shape: top-level `posts` with `authorId` (mirrors `recipes`: one equality query
per author for the feed, reuses the existing `mutualFriendOf` rule function, no
collection-group index, and expiry is a single `authorId == me` query).

- PASS build clean, `check-jsx-imports` exit 0, `npm test` 38/38 (socialFeed tests rewritten
  for posts: two posts of one recipe = two entries; expiry deletes doc + photo; shared photo
  deleted once and only when no live post / own recipe still uses it; picker search).
- PASS browser click-through (`artifacts/pantry-post-composer/post-check.mjs`, stubbed
  Firestore + stubbed final Storage put, REAL liveFeedPosts, REAL PostComposer, REAL
  storage.js decode/downscale): Post -> photo -> categories Breakfast/Dinner/Dessert/Sauces ->
  "chili" filters to 2 across 2 categories -> select -> Post -> uploaded to
  `recipes/{uid}/posts/...jpg` (1400x1050) and "You / just now / Mom's Chili" at the top.
  Second post of the same recipe with a different photo -> 2 separate entries, 2 distinct
  photos. Recipe's own photo unchanged, zero recipe writes. Copy on a friend's post: dup dialog
  names "Mom's Chili", Cancel = 0 copies, Save anyway copies the full recipe (7 ingredients, 2
  steps, the recipe's OWN photo URL, originalRecipeId = recipe id); curry copies without
  dialog. Tapping my post opens /recipe/mine-chili; Recipe Detail has no Post/Remove from
  Social. Broken friend avatar shows "H", refresh button present, 31-day post not rendered,
  no page errors. Screenshots in the same folder.
- NOT exercised against real Firebase: the new `posts` rules (no emulator / firebase CLI on
  this machine) and the live expiry sweep's deletes (unit-tested plan only).
- Deviations: Post button has no `capture` attribute, so phones offer both camera and library
  (`capture` would force camera-only). Own posts now show in your own feed (needed for "post
  appears at the top of the Feed"); no Copy button on your own posts. Feed section shows even
  with zero friends so you can post. `forkImage`/`compressedCopy`/`findCopiedUrls`/
  `postRecipeToFeed`/`unpostRecipeFromFeed`/`planExpiry` removed (dead). Old
  `postedToFeed`/`postedAt`/`imageUrlCompressed` fields on recipes are left as-is, unread.
- Ship order: deploy `firestore.rules` (new `posts` block) BEFORE or together with the push;
  without it the feed reads/creates on `posts` are denied.
