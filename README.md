# 🫙 Pantry

A warm, personal recipe-organizing web app — collect recipes you love, scale ingredients on the fly, cook hands-free, share with friends, and build a smart grocery list.

Built with **React + Vite + TailwindCSS** and **Firebase** (Auth + Firestore), with **Claude**-powered recipe import.

---

## 1. Prerequisites

- **Node.js 18+** (includes `npm`). Installed and verified (Node 24, npm 11).

Verify:
```powershell
node --version
npm --version
```

## 2. Install & run

```powershell
npm install
npm run dev
```
Then open the printed URL (default <http://localhost:5173>).

## 3. Environment variables

`.env` is already created (and gitignored). It contains the public Firebase web
config (safe to expose) plus the **server-side** Anthropic key:

```
ANTHROPIC_API_KEY=sk-ant-...
```

> ✅ **Security:** the Anthropic key has **no `VITE_` prefix**, so Vite never bundles
> it into the browser. Claude calls go through the serverless function
> `api/parse.js` (mirrored locally by dev middleware in `vite.config.js`). The
> browser only ever talks to `/api/parse` — see `src/lib/anthropic.js`. In
> production, set `ANTHROPIC_API_KEY` in the Vercel dashboard, not in a file.

## 4. Firebase console setup (required for login & data)

In the [Firebase console](https://console.firebase.google.com) for project **recipe-app-920c3**:

1. **Authentication → Sign-in method →** enable **Email/Password**.
2. **Firestore Database →** create a database (production or test mode).
3. **Deploy the security rules** in `firestore.rules`:
   - Paste them into **Firestore → Rules**, or
   - `firebase deploy --only firestore:rules` if you use the Firebase CLI.

Some queries (friends' recipes, friend requests, ordered recipe lists) may ask
Firestore to **create a composite index** the first time they run — click the link
in the browser console error to auto-create it. The app falls back gracefully
meanwhile.

## 5. What’s built (Core MVP)

| Area | Status |
| --- | --- |
| Design system, Nunito, eggshell/peach theme, textured bg | ✅ |
| Responsive nav (bottom tabs mobile / sidebar desktop) | ✅ |
| Auth: sign up / log in / **Browse as Guest** | ✅ |
| My Pantry + All Recipes (search, category filter, sort) | ✅ |
| RecipeCard with heart (pop animation) + pocket button | ✅ |
| Recipe Detail: hero, stats, checklist | ✅ |
| **Proportional ingredient scaling** + servings + reset + unit conversion | ✅ |
| **Cook Mode** (Wake Lock, big text, step highlight, prev/next) | ✅ |
| Recipe Editor (dynamic rows, draft autosave, discard guard) | ✅ |
| **AI Import**: URL (JSON-LD + proxy), paste-text, photo (Claude vision) | ✅ |
| Grocery list (combine, aisle groups, check, clear) | ✅ |
| **What Can I Make?** reverse search (own library) | ✅ |
| Friends: search, requests, friend pantries, **Pocket** mechanic | ✅ |
| Profile (bio/avatar, stats, logout) | ✅ |
| Firestore security rules | ✅ |
| Toasts, skeletons, animations, web manifest | ✅ |

## 6. Deploying to Vercel

The app is structured for Vercel: the Vite front-end builds to `dist/`, and the
two endpoints in `api/` deploy as serverless functions (keeping the Anthropic key
off the client).

1. Push this folder to a GitHub repo (or use `vercel` CLI from the folder).
2. At <https://vercel.com> → **Add New → Project**, import the repo. Vercel
   auto-detects Vite (build `npm run build`, output `dist`).
3. **Project → Settings → Environment Variables** — add all of these:
   - `ANTHROPIC_API_KEY` (the secret key)
   - the six `VITE_FIREBASE_*` values from `.env`
4. **Deploy.** You'll get a `https://<project>.vercel.app` URL.
5. In the [Firebase console](https://console.firebase.google.com) → **Authentication
   → Settings → Authorized domains**, add your `*.vercel.app` domain so login works.

Local dev (`npm run dev`) still works unchanged — `vite.config.js` mirrors the
`/api/*` functions so you don't need the Vercel CLI to develop.

## 7. Known follow-ups (not in this MVP pass)

- **PWA icons:** install adds an offline service worker (`vite-plugin-pwa`); the
  manifest still uses the SVG icon. Add 192/512 PNG icons + an `apple-touch-icon`
  for the best iOS home-screen experience.
- **Reverse search Layer 2** (friends' public recipes) — hook point marked in
  `src/pages/GroceryList.jsx`.
- **Notifications bell** ("X pocketed your recipe") — pocket events would write a
  notification doc; hook point noted in code.
- **Firebase Storage** image upload — currently photo is a URL field; hook point
  marked in `src/pages/RecipeEditor.jsx` and `src/firebase.js`.
- Drag-to-reorder steps uses up/down buttons (no drag library pulled in).

## 8. Project structure

```
src/
  contexts/    AuthContext, DataContext
  components/  Layout, RecipeCard, Filters, Toast, Skeleton
  pages/       Pantry, AllRecipes, RecipeDetail, RecipeEditor,
               ImportModal, GroceryList, Friends, Profile, Auth
  lib/         scaling, anthropic, jsonld, firestore, categories
  data/        sampleRecipes
  firebase.js
```
