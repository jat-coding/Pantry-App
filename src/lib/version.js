// App version + changelog. Surfaced at the bottom of the Profile page.
// Add a new entry to the TOP of CHANGELOG each release and bump APP_VERSION.

export const APP_VERSION = '1.7.0'

export const CHANGELOG = [
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
