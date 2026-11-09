# Friends tab → Social tab: Strava-style recipe feed

## His words (verbatim, in order)

> "I am wanting to make the friends tab into a social tab and allow people to post their
> dinner or recipe as an image, link the recipe and allow people to copy from there. And
> then with that show the date and what not almost like a Strava version of recipes. Let
> me know of any questions you will run into. Also I want the storage to be optimized be
> wary of how much space holding images of each person there should be a permanent record
> located on the respective profile page. But for the social public they can clear images
> after a month"

Follow-up, unprompted: "Social should have the full res image and the record saved in
profile should be compressed not as prioritized"

Follow-up, unprompted: "But it shouldn't duplicate if there already is a recipe. There
should also be some intelligence that can notice recipes that have very similar
ingredients and make the user aware that it might be a duplicate recipe"

Tap answers, in order:
1. "Is a 'post' just an existing recipe tagged with a feed timestamp, or a separate
   lighter dinner-log entry...?" → **Existing recipe + feed flag (reuses what's already
   built)**
2. "Feed image storage — compressed feed copy auto-deletes after 30 days while the
   profile keeps the full-res original forever, or just filter the feed by date...?" →
   He overrode both options: **"Social should have the full res image and the record
   saved in profile should be compressed not as prioritized"**
3. "When a feed post ages past 30 days, does it vanish from the feed entirely, or stay
   visible as text/link with the photo stripped out?" → **Vanish from feed entirely**
4. "'Copy from there' — copying into the viewer's own pantry, or just viewing the
   link?" → **Copy into own pantry**
5. "Where should duplicate-checking run — social-feed copy only, or every new recipe
   add/import?" → **Social-feed copy only**
6. "What counts as 'already have it'?" → **Any recipe with a close title/ingredient
   match, even ones you typed yourself** (not just the same post pocketed twice)
7. "Similar-ingredients duplicate warning — block/confirm, or non-blocking heads-up?" →
   **Must confirm "save anyway" before it saves**
8. Shown a proposed threshold (Jaccard ingredient-set overlap ≥60% AND ≥4 shared
   ingredients) with a trigger example (two chilis sharing 6/7 ingredients) and a
   non-trigger example (choc-chip vs. oatmeal cookies sharing 4/9) → **"Stricter (fewer
   false alarms, misses some near-dupes)"** — no exact number given; this card locks in
   **≥75% overlap AND ≥5 shared ingredients** as the stricter number. If this misses or
   over-triggers in real use, that's a FEEDBACK.md entry, not a guess to get right blind.

## Goal

Turn the existing Friends tab into a Social tab: on top of the friend-search/requests/
view-a-friend's-whole-pantry it already does, add a chronological, Strava-style feed of
recipes friends have explicitly posted — photo, title/recipe link, date, and a copy
action — optimized so the expensive full-res bytes don't accumulate forever.

## Data model / architecture (from reading firestore.js, storage.rules, imageSnapshot.js)

- No new entity. `recipes/{id}` gets two new fields: `postedToFeed: boolean`,
  `postedAt: serverTimestamp`. A recipe's own author sets these (e.g. a "Post to Social"
  action from their own recipe, probably Recipe Detail's existing share/menu area —
  follow whatever pattern `isPublic` toggling already uses there, don't invent a new UI
  idiom for it).
- Today `imageUrl` is the recipe's one full-res image, stored untouched forever
  (`imageSnapshot.js`'s explicit design: "no re-compression = equal quality"). That
  behavior does NOT change for recipes in general — My Pantry, Recipe Detail, a friend's
  full pantry view all keep showing full-res exactly as today.
- **Social feed** reads that same existing full-res `imageUrl` directly — no new upload
  needed for "full res in the feed," it's already full res.
- **Permanent compressed record**: when a recipe is posted (or lazily, the first time it's
  posted), generate a compressed derivative via the existing canvas-resize/encode helpers
  in `src/lib/image.js` (same budget/approach as the avatar/recipe-photo-field path) and
  store it as a new `imageUrlCompressed` field. This is the thing that survives forever —
  it is NOT shown anywhere yet except where the 30-day expiry repoints to it (next point).
- **30-day expiry** (a post, not the recipe, "vanishes from the feed entirely"): once
  `postedAt` is >30 days old: flip `postedToFeed` to `false` (removes it from the feed
  query) AND, to actually reclaim space, delete the full-res Storage object behind
  `imageUrl` and repoint the recipe's `imageUrl` to the value already in
  `imageUrlCompressed`. From that point on the recipe's own profile/pantry views show the
  compressed copy — matching "permanent record... should be compressed, not prioritized."
  This repo has no server cron today (no Firebase Functions, no `vercel.json` crons) —
  default to a **lazy, client-triggered sweep**: whenever the feed query runs, any
  fetched post whose `postedAt` is already >30 days old gets expired client-side
  (update + storage delete) before being filtered out of what's rendered, rather than
  building new scheduled-job infra for this. Flag in the hand-back if this needs to be a
  real cron instead (e.g. if a post with no active viewers would otherwise never expire).
- **Copying a post must fork its own image copy.** `pocketRecipe` → `createRecipe` copies
  the recipe DOCUMENT (including the bare `imageUrl` string) but not the underlying
  Storage object — the copy would keep pointing at the ORIGINAL author's file. Once the
  30-day expiry deletes that file (above), every pocketed copy would break too. Fix: the
  social-feed copy path must call the existing `snapshotImage()` helper
  (`src/lib/imageSnapshot.js`, literally built for "keep our own copy so the recipe
  survives the source dying") to fork the image into the copier's own
  `recipes/{copierUid}/` folder before/while creating the pocketed recipe, so it's
  independent of the original's lifecycle. Regular (non-feed) pocketing elsewhere in the
  app is unaffected — this only applies to the new social-copy path, since existing
  pocketing today has no expiry to worry about.

## Duplicate check (social-feed copy only)

- On tapping copy from a feed post, before writing the pocketed recipe: compare the
  post's ingredient list against every recipe already in the viewer's own library
  (self-authored + previously pocketed — everything `listenMyRecipes` returns for them).
- Normalize each ingredient to just its name (strip quantity/unit/prep notes, lowercase,
  trim), then Jaccard-overlap the two name sets. Flag "possible duplicate" against the
  single best-matching existing recipe when overlap is **≥75% AND at least 5 ingredients
  are shared** (the count floor stops tiny recipes — 2-3 ingredients — from false-matching
  on trivial overlap).
- On a match: show `ConfirmDialog` (existing component) — "This looks a lot like your
  '<existing recipe title>' — save anyway?" / Cancel vs. a confirm label. Only on explicit
  confirm does the pocket copy proceed; Cancel just closes it, no copy happens.
- No match → copy proceeds exactly as `handleCopyToPantry` does today.

## Feed UI

- New section in the Social tab (same URL/route the Friends tab already owns), rendered
  above or alongside the existing friend-search/requests list — Friends functionality
  itself is not removed.
- Query: recipes authored by anyone in `friends` (profile.friendIds) with
  `postedToFeed === true`, sorted by `postedAt` descending (Firestore `where authorId in
  [...]` — note the 30-item cap on `in`; fine for a normal friend count, flag in hand-back
  if it needs chunking for someone with 30+ friends).
- Each feed row/card: image (full-res `imageUrl`), title linking to Recipe Detail, author
  name/avatar, human-readable relative-or-absolute date ("2d ago" / actual date past a
  week — match whatever date-formatting convention, if any, already exists in this repo;
  otherwise pick one and use it consistently), and a copy button wired to the new
  duplicate-check-then-pocket flow above.
- Empty state: no friends have posted anything yet (distinct from "no friends" empty
  state, which already exists).

## Not doing

- No likes/comments/engagement features — this is an activity feed, not full social
  (he never asked for either; don't add them).
- No separate lightweight "dinner log" post type — locked by tap answer 1.
- No duplicate-checking on manual add/import anywhere else in the app — locked by tap
  answer 5.
- No change to existing (non-feed) pocketing behavior or to how My Pantry/Recipe
  Detail/a friend's full pantry page show images for recipes that were never posted.

## Reference

None given.

## Done when

- `npm run build` clean, `node scripts/check-jsx-imports.mjs` passes, `npm test` green.
- A recipe posted to the feed shows full-res in the Social feed; a friend who hasn't
  posted anything doesn't show up in it.
- A posted recipe older than 30 days (simulate via a backdated `postedAt` in a test
  fixture) no longer appears in the feed, and its own Recipe Detail/My Pantry view still
  shows a working image (the compressed one) rather than a broken link.
- Copying a feed post: (a) lands in the copier's own Pantry, (b) still shows its image
  after the original author's copy is later expired (prove the Storage fork actually
  decoupled them), (c) a post whose ingredients closely match something already in the
  copier's library shows the confirm dialog naming that existing recipe, and only copies
  on explicit confirm — Cancel must leave their library unchanged.
- A near-duplicate check against a non-matching recipe (e.g. unrelated cuisine, <5 shared
  ingredients) does not show the dialog.
- Existing Friends functionality (search, requests, viewing a friend's full pantry,
  favorites toggle) still works unchanged on the renamed Social tab.

## Tries

5

## Open questions

None — every prior open question above was resolved by a tap answer. The lazy-vs-cron
expiry choice and the exact confirm-dialog copy are implementation details the build
should make and report, not block on.

## Result (2026-11-08, v1.38.0, local commit on main, NOT pushed)

- PASS build / jsx-imports / tests: `npm run build` clean (no warnings), `check-jsx-imports` exit 0, `npm test` 36/36 (8 new in `tests/socialFeed.test.js`).
- PASS posted recipe full-res in feed, non-posting friend absent: browser click-through
  (`artifacts/pantry-social-feed/feed-check.mjs`, stubbed Firestore, real filter): feed image
  naturalWidth 1600x1200 = the source; friend "Zed NoPosts" in My Friends but 0 feed cards.
- PASS (unit + browser) 30-day expiry: 31-day-old post not rendered; `planExpiry` test proves
  unflag + repoint `imageUrl` to `imageUrlCompressed` + delete full-res only when a compressed copy
  exists and no other own recipe shows the same file. NOT checked against real Firebase (no emulator).
- PASS copy (a)/(c): copy lands via `pocketRecipe` + heart; near-dupe chili shows
  "This looks a lot like your "Mom's Chili". Save anyway?"; Cancel -> 0 copies; Save anyway -> 1.
- PARTIAL copy (b): copy path calls `forkImage` with the copier's uid and saves the fork URL
  (verified in browser). The real Storage upload was not exercised (stubbed; needs a signed-in account).
- PASS non-matching (curry, 0 shared) copies with no dialog; unit tests cover 4/10 cookies, 5-shared-62%, 3-ingredient 100%.
- PASS Friends functions: search box, invite, My Friends, View Pantry overlay all render and open on the renamed tab.

Deviations: per-friend equality queries instead of `in` (no 30 cap, no new index, existing rules
cover it); expiry runs on the AUTHOR's app (rules only let the author edit/delete), and the feed
hides >30-day posts for every viewer by date regardless; title match and "same post already copied"
also trigger the dialog (tap answer 6). No rules changes needed. Fresh-context review subagent was
blocked by a hook on this run; self-review only.
