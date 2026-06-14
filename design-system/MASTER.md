# Pantry — Design System (MASTER)

Source of truth for the visual system. Every screen inherits these locked
decisions. A `pages/<screen>.md` file, if present, overrides this for that screen.

## Step 1 — Product classification
- **Category:** Lifestyle / recipe app (food).
- **Audience & state:** Home cooks on their phone, relaxed, often in the kitchen
  mid-cook. Warm, unhurried, hands sometimes messy → big touch targets, legible type.
- **The one job:** Find a recipe you love and cook it.

## Step 2 — The seven locked decisions

### 2.1 Aesthetic direction
**"Warm modern pantry"** — organic, appetizing, tactile, with an editorial-cookbook
warmth. Refined, not loud. Every decision below derives from this.

### 2.2 Layout pattern
**Task-first.** Mobile: bottom tab bar, content fills the viewport, one primary
action per screen. Desktop: left sidebar nav + max-w content column. Recipe = hero
image + scannable meta + ingredients/steps.

### 2.3 Visual style
**Soft / organic** with **editorial** typography. Rounded 2xl surfaces, soft warm
shadows, generous spacing, a characterful serif for headings.

### 2.4 Color (tokens live in tailwind.config.js)
| Role | Token | Hex | Notes |
|---|---|---|---|
| Background | `eggshell` | #F0EAD6 | app background (subtle warm texture) |
| Surface | `white` | #FFFFFF | cards |
| Surface 2 | `surface-2` | #FAF4E8 | layered/warm surface |
| Brand (identity) | `peach` / `peach-dark` | #FFCBA4 / #F2A977 | logo, selected states, saved-heart. Identity, used generously but NOT for the action button. |
| **CTA / action** | `cta` / `cta-dark` | #BE531F / #9C4019 | **reserved for the primary action only** so it always means "tap here". White text passes AA (≈4.75:1). |
| Secondary accent | `herb` / `herb-dark` | #5E7C4F / #4C6740 | success / "in pantry" / friend accents |
| Text | `warm` | #2C2416 | near-black, primary text |
| Text muted | `warm-soft` | #6B5E4A | secondary text |

Rule: peach = brand, terracotta (`cta`) = action, herb = positive accent. Don't mix.

### 2.5 Typography
- **Display:** **Fraunces** (warm, high-character serif) — headings, recipe titles, card titles.
- **Body:** **Nunito** — everything else; built for small-size reading.
- Both shipped via Google Fonts `<link>` in index.html. Body ≥16px. Display line-height ~1.1–1.2, body ~1.5.
- Never Inter/Roboto/Arial/system.

### 2.6 Signature & atmosphere
**The recipe card + Cook Mode** are the memorable centerpiece: serif title, warm
image treatment with a soft gradient, a satisfying heart "pop", and a focused,
auto-centering Cook Mode. Spend boldness here; keep everything else quiet. The
eggshell background carries a faint warm grain for depth (not a flat fill).

### 2.7 Spacing & scale
8-pt grid (4/8/12/16/24/32/48/64). Type scale ~1.25. Touch targets ≥44px. Content
columns capped with max-width. Verify at 375 / 768 / 1024 / 1440.

### 2.8 Motion
Subtle, 150–300ms ease. One signature moment (heart pop, Cook Mode step centering).
`prefers-reduced-motion` respected globally. When unsure, cut it.

## Iconography
SVG line icons only (no emoji as UI). Category placeholders use a custom food-icon
set (`CategoryIcon` in src/components/icons.jsx). Functional icons live in the same file.

## Pre-ship checklist (run before declaring done)
Focus-visible on all interactive elements · ≥44px targets · contrast ≥4.5:1 ·
hover/active/focus/disabled/empty/error states · reduced-motion · no overflow at
375/768/1024/1440 · real copy · 8-pt spacing.
