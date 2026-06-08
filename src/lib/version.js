// App version + changelog. Surfaced at the bottom of the Profile page.
// Add a new entry to the TOP of CHANGELOG each release and bump APP_VERSION.

export const APP_VERSION = '1.0.0'

export const CHANGELOG = [
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
