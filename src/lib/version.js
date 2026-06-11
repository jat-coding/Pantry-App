// App version + changelog. Surfaced at the bottom of the Profile page.
// Add a new entry to the TOP of CHANGELOG each release and bump APP_VERSION.

export const APP_VERSION = '1.3.3'

export const CHANGELOG = [
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
