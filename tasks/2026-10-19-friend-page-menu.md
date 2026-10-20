# Friend's pantry page: hamburger menu for Remove / See their friends

## Goal

Voice memo: on a friend's pantry page, the top right should be three lines (a hamburger
icon) that pops up a menu with two choices — remove them (with a confirmation first) or
see their friends. The "their friends" list should stay limited to one action: add.

Checked the code first: both pieces already exist in `src/pages/Friends.jsx`'s
`FriendProfile`/`FriendsOfFriend` components. "Remove" is already a plain always-visible
text button in the header with a confirm dialog ("Remove this friend?"). The
friend's-own-friends section is already always-visible below their recipes, and is
already Add-only (Friends/Accept/Requested/Add, nothing else). So this is a layout and
entry-point change, not new functionality: collapse both already-visible pieces behind a
single hamburger menu, so the default page view is just the friend's recipes.

## Done when

1. **Header**: the plain "Remove" text button in `FriendProfile`'s header is replaced
   with a hamburger icon button (lucide-react `Menu`, matching the existing icon usage
   in this file — `ChevronLeft`, `Check`) in the same top-right position.
2. **Menu**: tapping it opens a small menu/action sheet with exactly two items: "Remove"
   and "See their friends." Style consistent with any existing menu/sheet pattern
   already in this app (check `Pantry.jsx`/`Layout.jsx` or similar for a precedent
   before inventing a new one).
3. **Remove**: tapping "Remove" in the menu closes the menu and opens the existing
   `ConfirmDialog` ("Remove this friend?") exactly as today — no change to that flow or
   its wording.
4. **See their friends**: tapping it reveals the existing `FriendsOfFriend` section
   (scrolls to it / expands it — your call on the simplest correct mechanism), which is
   hidden by default now instead of always-visible. No change to `FriendsOfFriend`'s own
   logic or the Add/Requested/Accept/Friends states — it's already scoped correctly.
5. **Default view**: opening a friend's pantry page with neither menu item chosen shows
   just their recipes — no Remove button, no friends-of-friends section — until the
   hamburger menu is used.
6. No regressions: removing a friend, sending/accepting a friend-of-friend request, and
   viewing a friend's recipes all still work exactly as before, just reached through the
   menu. `npm run build` succeeds with no new warnings.

## Reference

None — no screenshot/URL given; build to the written description above.

## Not doing

- Any change to who can see what (permissions/Firestore rules) — purely a layout change.
- Any change to the Add/Requested/Accept/Friends logic in `FriendsOfFriend`.
- A separate full-screen route for "see their friends" — reveal the existing section in
  place unless that turns out to be awkward, in which case say so in the report rather
  than silently picking a different design.

## Tries

5

## Open questions

None — the scope is a layout/entry-point change to already-working pieces, not a new
feature with branching answers.

## Result

v1.33.0, local commit only (not pushed). Verified with a UI harness that mounts the real
Layout + DataProvider + Friends.jsx (FriendProfile, FriendsOfFriend, ConfirmDialog) with
only Auth and Firestore stubbed, in Chromium and WebKit at 390x844 (plus one desktop
1280x800 check): 18/18 checks pass in both. Harness, script, screenshots and JSON results:
`/home/roni/agent/artifacts/pantry-friend-menu-2026-10-19/`.

1. Header: **PASS**. Back left, lucide `Menu` button right (44x44, same white round
   style/stroke as Back), no Remove text button. `chromium-1-default.png`.
2. Menu: **PASS**. Exactly two items, "See their friends" then "Remove" (Remove in red,
   last, as the destructive one). Reuses the Layout add-menu popover styling (white
   rounded-2xl card, rounded-xl rows, tap outside to close); there was no other menu
   pattern in Pantry.jsx / RecipeDetail.jsx / GroceryList.jsx. Lines up under the icon on
   desktop too. `chromium-2-menu-open.png`, `chromium-6-desktop-menu.png`.
3. Remove: **PASS**. Menu closes, existing "Remove this friend?" ConfirmDialog opens
   unchanged; Cancel removes nothing; Remove calls removeFriend(me, friend) once and
   closes the page. `chromium-3-remove-confirm.png`.
4. See their friends: **PASS**. Menu closes, FriendsOfFriend section mounts and scrolls
   so its heading sits just under the sticky header (checked with 8 recipes, section
   starting off-screen). Rows keep Add / Accept / Requested / Friends exactly; Add still
   sends one request, Accept still accepts. Choosing it again scrolls back to it.
   FriendsOfFriend itself is untouched. `chromium-4-their-friends.png`,
   `chromium-5-after-add-accept.png`.
5. Default view: **PASS**. Only avatar/name/bio and recipes; no friends section, no
   Remove, and the friend's friends list is not even fetched until chosen.
6. No regressions: **PASS**. Remove/Add/Accept as above; tapping a friend recipe still
   navigates to /recipe/<id>; no console warnings/errors in either engine;
   `npm run build` has no warnings (same as before the change); `npm test` 14/14.

Not covered: no React component test runner in this project (`node --test` is pure logic
only), so the harness is the verification. No real Firebase data or real iPhone tap.

Design note: the section is revealed in place below the recipes. Because it loads after
the scroll starts and sits at the very end of the page, the wrapper reserves a screen's
height so the heading lands under the header instead of near the bottom; this leaves
empty eggshell space under a short friends list.
