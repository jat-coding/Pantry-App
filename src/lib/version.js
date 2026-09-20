// App version + changelog. Surfaced at the bottom of the Profile page.
// Add a new entry to the TOP of CHANGELOG each release and bump APP_VERSION.

export const APP_VERSION = '1.18.1'

export const CHANGELOG = [
  {
    version: '1.18.1',
    date: '2026-09-19',
    changes: [
      'The bottom tab bar sits lower on the screen and the + button is smaller, leaving more room for your recipes.',
    ],
  },
  {
    version: '1.18.0',
    date: '2026-09-19',
    changes: [
      'Recipe photos that come from a web link are now saved as our own copy at full quality, so they will not disappear if the original link breaks. Older recipes update the next time you open them.',
    ],
  },
  {
    version: '1.17.5',
    date: '2026-09-19',
    changes: [
      'The Help tour now fits on one screen with no scrolling.',
    ],
  },
  {
    version: '1.17.4',
    date: '2026-09-19',
    changes: [
      'Fixed a crash (Something went wrong screen) on screens that show recipe cards.',
    ],
  },
  {
    version: '1.17.2',
    date: '2026-09-19',
    changes: [
      'The Pantry tab icon now matches the app icon.',
      'Friends: Share and Copy link are now one slim row under the search bar instead of a big card.',
    ],
  },
  {
    version: '1.17.1',
    date: '2026-09-19',
    changes: [
      'Recipe photos that failed to show (blocked by the source site, http links, odd link formats) now load, and if one truly cannot load you see the category icon instead of a blank box.',
    ],
  },
  {
    version: '1.17.0',
    date: '2026-09-16',
    changes: [
      'Every icon in the app now comes from one consistent icon set (Lucide) — tabs, buttons, checkmarks, close and back arrows, the heart, and the no-photo category placeholders — and the last emoji are gone. The app\u2019s home-screen icon is unchanged.',
    ],
  },
  {
    version: '1.16.1',
    date: '2026-09-14',
    changes: [
      'The tab you tap now does a quick little jiggle as the pill slides over to it.',
    ],
  },
  {
    version: '1.16.0',
    date: '2026-09-14',
    changes: [
      'The bottom tab bar now has a peach pill that slides smoothly to whichever tab you tap, instead of the highlight just jumping.',
    ],
  },
  {
    version: '1.15.0',
    date: '2026-09-13',
    changes: [
      'Closing anything now takes you back to the exact screen you came from — back from a recipe, cancelling or saving in the editor, deleting a recipe, and leaving Profile all return to where you were.',
      'Going back puts you at the same spot you had scrolled to, not the top of the list.',
      'A friend\u2019s pantry stays open when you open one of their recipes and come back.',
      'Profile now has a back button.',
    ],
  },
  {
    version: '1.14.0',
    date: '2026-09-13',
    changes: [
      'The import progress bar now tracks the real work — actual download and transcription progress, plus a time estimate that learns from how long recent imports took — instead of a fixed guess.',
      'Recipes imported from a video (YouTube, TikTok, Instagram, Facebook) now use the video\u2019s thumbnail as the recipe photo.',
      'A friend\u2019s pantry no longer gets cut off at the top or bottom on any phone, and the back button now sits cleanly at the top-left and stays there as you scroll.',
    ],
  },
  {
    version: '1.13.1',
    date: '2026-09-12',
    changes: [
      'Cleaner imports: ingredient names no longer carry store/brand/price clutter, and instruction steps strip out video-transcript noise (background-music tags, timestamps, "like and subscribe," filler words) instead of leaving it in the recipe.',
    ],
  },
  {
    version: '1.13.0',
    date: '2026-09-12',
    changes: [
      'Recipe-URL imports now fetch through the same reliable route video links already use, so a slow site can’t get cut off partway through — with the same progress bar and ETA.',
    ],
  },
  {
    version: '1.12.0',
    date: '2026-09-12',
    changes: [
      'Fixed: buttons could get stuck looking pressed/darker after a tap and stay that way until you tapped something else — a known mobile-browser quirk, now fixed app-wide.',
      'Every confirmation popup (delete recipe, remove friend, discard changes, clear grocery list) is now a Pantry-styled popup instead of the browser’s plain gray one.',
    ],
  },
  {
    version: '1.11.3',
    date: '2026-09-12',
    changes: [
      'Fixed: video import could wrongly say a link "took too long to load" even though it was still working — reading a video’s details is now a background check-in instead of one long wait.',
      'TikTok, Instagram, and Facebook links now get the same reliable video-reading path YouTube already had.',
      'Video import now shows a real progress bar with an estimated time remaining instead of a static "this can take a minute or two" message.',
    ],
  },
  {
    version: '1.11.2',
    date: '2026-09-12',
    changes: [
      'Fixed: importing from a YouTube link could get blocked by YouTube’s "confirm you’re not a bot" page. Reading a video’s title/description now happens the same reliable way the deeper video-reading fallback already did.',
    ],
  },
  {
    version: '1.11.1',
    date: '2026-09-12',
    changes: [
      'The "read the video itself" fallback no longer holds one long request open — it checks in a few times a second instead, so it can’t get cut off partway through a longer video.',
    ],
  },
  {
    version: '1.11.0',
    date: '2026-09-12',
    changes: [
      'When a video’s description doesn’t have the recipe, you can now have Pantry actually watch and listen to the video itself to build the recipe — a slower fallback (about a minute), not the default.',
    ],
  },
  {
    version: '1.10.3',
    date: '2026-09-10',
    changes: [
      'Saving an edited recipe now returns you to the screen you opened it from, instead of stranding you on the recipe page.',
      'The Save button now lives in a banner pinned to the top of the recipe editor, so it stays reachable no matter how far you’ve scrolled.',
      'A friend’s pantry now has a floating Back button that follows you as you scroll, not just the one at the very top.',
      'Cook Mode now hides the bottom tab bar — only Prev/Next are shown — until you exit.',
    ],
  },
  {
    version: '1.10.2',
    date: '2026-08-10',
    changes: [
      'Scrolling inside a friend’s pantry no longer scrolls the page behind it — the same fix applies to the import sheet and the help tour.',
    ],
  },
  {
    version: '1.10.1',
    date: '2026-08-09',
    changes: [
      'Unselected category buttons no longer look like they vanished — they stay as clear white chips until you pick them.',
      'The add-recipe menu now opens in the middle of the screen instead of appearing off to the right and jumping into place.',
    ],
  },
  {
    version: '1.10.0',
    date: '2026-08-08',
    changes: [
      'YouTube imports now read the video’s own title and description instead of scraping the page, so recipes written in the description come through much more cleanly.',
      'When a YouTube recipe is only spoken aloud, Pantry now says so and points you to the video’s “Show transcript” button to paste in — and it tells you plainly when a video is private or unavailable.',
      'Adding a photo no longer freezes the screen while the image is being prepared, and repeat photos are much faster.',
    ],
  },
  {
    version: '1.9.1',
    date: '2026-08-02',
    changes: [
      'Fixed: adding a photo to a recipe could hang on “Uploading…” and never finish, most often on Android. Photos now open using far less memory, every step gives up rather than hanging, and you get a clear reason if one can’t be used.',
      'Portrait photos taken on a phone no longer appear sideways.',
      'The starter recipes in a new account are now credited to Pantry rather than to you.',
    ],
  },
  {
    version: '1.9.0',
    date: '2026-08-02',
    changes: [
      'Import a recipe straight from a PDF or Word document — the Photo tab is now “File” and takes photos, PDFs, and .docx files.',
      'Scanned and photographed PDFs work too, not just digital ones.',
    ],
  },
  {
    version: '1.8.0',
    date: '2026-08-02',
    changes: [
      'On a recipe, you can now change an ingredient’s unit — the amount converts to match (e.g. 1 cup → 16 tbsp). The unit picker sits at the end of the row, clear of the amount, so it’s never a mis-tap.',
      'Ingredient amounts can now be cleared completely and retyped from scratch, and accept fractions like 1/2.',
      'Cleaner imports: weights now come in as oz/lb instead of grams where sensible, and ingredient names are tidied up — prices, store/brand clutter, and other shopping noise are stripped out.',
    ],
  },
  {
    version: '1.7.0',
    date: '2026-06-18',
    changes: [
      'New floating toolbar with a big + in the middle — add a recipe from any screen.',
      'First-time tour of the app, plus a “?” button on your Pantry to see it again anytime.',
      'Ingredient quantities now accept fractions (½, 1/2, 1 1/2).',
      'Prep and cook time fields can be cleared and retyped freely.',
      'Saving a brand-new recipe now takes you back to your library.',
      'The back arrow on a recipe returns you to where you opened it from.',
      'List view now shows a thumbnail next to each recipe.',
      'Your Profile is now reached from the top-right of the Friends screen.',
    ],
  },
  {
    version: '1.6.0',
    date: '2026-06-14',
    changes: [
      'A warm visual refresh: a new cookbook-style heading font (Fraunces), refined colors, and more polish throughout.',
      'A distinct action color so the main button on each screen clearly stands out.',
      'Category placeholders are now tasteful food icons instead of emoji.',
      'Accessibility upgrades: clear keyboard focus, bigger tap targets, and reduced-motion support.',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-06-14',
    changes: [
      'Recipes can now belong to several categories at once (e.g. Snacks and Lunch).',
      'Filter by multiple categories at once on Pantry and All Recipes, and sort your Pantry by newest, A–Z, or cook time.',
      'Recipe photos and profile avatars can be uploaded from your camera roll (stored in the cloud, with a safe fallback).',
      'Friend search is now case-insensitive.',
      'Add a quantity and unit when adding grocery items by hand.',
      '“What Can I Make?” now also suggests your friends’ recipes, with one-tap Copy to Pantry.',
      'More resilient: a friendly recovery screen instead of a blank page if anything ever crashes, plus tighter image handling and visual polish.',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-06-12',
    changes: [
      'Share a recipe link (Instagram, TikTok, YouTube…) straight into Pantry — it opens the importer and parses it for you.',
      'Imports now clearly tell you when a recipe couldn’t be built (and why) instead of failing silently or hanging.',
      'Imports can no longer create half-empty recipes — a recipe needs a title, ingredients, and steps to be saved.',
      'Every import step now times out, so the app never gets stuck on “Working…”.',
    ],
  },
  {
    version: '1.3.3',
    date: '2026-06-11',
    changes: [
      'Cook Mode now has an Exit button pinned to the top of the screen.',
    ],
  },
  {
    version: '1.3.2',
    date: '2026-06-11',
    changes: [
      'Cook Mode now auto-centers each step on screen as you move through the recipe.',
      'The Prev/Next step controls now sit above the bottom tab bar instead of behind it.',
    ],
  },
  {
    version: '1.3.1',
    date: '2026-06-10',
    changes: [
      'Fixed for real: importing by pasted text or photo no longer ever blanks the screen — every imported recipe is normalized to a safe shape before it opens in the editor.',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-06-09',
    changes: [
      'Fixed: importing a recipe by pasted text or photo no longer fails to a blank screen.',
      'Ingredient units are now abbreviated (tbsp, tsp, oz…) so long names no longer overlap.',
      'Grocery list now merges duplicate ingredients, even across different unit spellings.',
      "A friend's profile now shows their full pantry with a one-tap “Copy to Pantry”.",
    ],
  },
  {
    version: '1.2.0',
    date: '2026-06-08',
    changes: [
      'Simpler pantry cupboard icon, and a matching new app icon on your home screen.',
      'Category emojis are back on recipe cards and detail pages.',
      'Fixed: creating a recipe now leaves the editor and prevents accidental duplicates.',
      'Fixed: deleting a recipe now returns you to the main page.',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-06-08',
    changes: [
      'New monochrome (greyish-black) icon set across the app — including a redesigned pantry-shelf tab icon — and emojis removed from tab headers.',
      'Pantry view toggle moved to its own section above the categories.',
      'Added a "Sauces & Dressings" category.',
      'Recipes can now be deleted from the recipe page.',
      'More reliable URL import (reads JSON-LD + full page), plus a new Video import tab.',
      'Recipe photos can be chosen from your camera roll.',
      'The "Add to Pantry?" prompt now uses the pantry icon.',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-06-08',
    changes: [
      'Secure cloud deploy on Vercel — the AI recipe import now runs server-side, so the API key is never exposed.',
      'iPhone-ready layout: Dynamic Island spacing at the top, safe-area room under the tab bar, and pinch-zoom disabled.',
      'New line-style tab icons (no emojis) and a symmetric heart. Grocery moved to the left, Pantry centered.',
      'Pantry now has a grid/list toggle — list view shows title, time, and category.',
      'Invite friends with a shareable link.',
      'Export all your recipes to a formatted Excel file from Profile.',
    ],
  },
]
