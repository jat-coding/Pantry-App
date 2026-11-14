// Bottom tab bar looks. Since v1.39.4 everyone gets Frosted glass (useNavStyle below);
// the other entries are kept only so the old picker is one change away.
//
// One module owns every class string the bar uses so Layout stays a layout file and
// adding a look is a single entry here. `bottom` is how much room is left under the
// bar on top of the phone's home-indicator inset: 0 = flush with the bottom edge.
//
// The choice is per-device (localStorage), not per-account: it's a look, and syncing
// it to Firestore would make a taste change on the iPad rewrite the phone.

export const NAV_STYLE_KEY = 'pantry.navStyle'

export const NAV_STYLES = [
  {
    id: 'glass',
    label: 'Frosted glass',
    hint: 'Blurred, the page shows through',
    bottom: '0.125rem',
    wrap: 'px-3',
    bar: 'rounded-full border border-white/50 bg-white/55 shadow-card-hover backdrop-blur-xl backdrop-saturate-150',
    ring: 'ring-white/60',
    mainPad: '5.5rem',
  },
  {
    id: 'rectangle',
    label: 'Rectangle box',
    hint: 'Full-width bar along the bottom edge',
    bottom: '0',
    wrap: 'px-0',
    bar: 'w-full justify-around rounded-none border-t border-warm/10 bg-white shadow-[0_-2px_12px_rgba(44,36,22,0.06)]',
    ring: 'ring-white',
    mainPad: '5.75rem',
  },
  {
    id: 'opaque',
    label: 'Opaque',
    hint: 'Solid white pill, no blur',
    bottom: '0.125rem',
    wrap: 'px-3',
    bar: 'rounded-full border border-warm/10 bg-white shadow-card-hover',
    ring: 'ring-eggshell',
    mainPad: '5.5rem',
  },
  {
    id: 'dark',
    label: 'Charcoal',
    hint: 'Dark pill — the icons pop',
    bottom: '0.125rem',
    wrap: 'px-3',
    bar: 'rounded-full border border-white/10 bg-warm/90 shadow-card-hover backdrop-blur-xl',
    ring: 'ring-warm/90',
    mainPad: '5.5rem',
    dark: true,
  },
  {
    id: 'minimal',
    label: 'Floating icons',
    hint: 'No bar at all, just the icons',
    bottom: '0.125rem',
    wrap: 'px-3',
    bar: 'rounded-full border border-transparent bg-transparent shadow-none',
    ring: 'ring-eggshell',
    mainPad: '5.25rem',
  },
]

export const DEFAULT_NAV_STYLE = 'glass'

export function getNavStyle(id) {
  return NAV_STYLES.find((s) => s.id === id) || NAV_STYLES.find((s) => s.id === DEFAULT_NAV_STYLE)
}

export function readNavStyle() {
  try {
    return localStorage.getItem(NAV_STYLE_KEY) || DEFAULT_NAV_STYLE
  } catch {
    // Private browsing / storage disabled — the default look is still correct.
    return DEFAULT_NAV_STYLE
  }
}

export function writeNavStyle(id) {
  try {
    localStorage.setItem(NAV_STYLE_KEY, id)
  } catch {
    /* not fatal — the pick just won't survive a reload */
  }
  // Same-tab storage events don't fire, so tell listeners directly.
  window.dispatchEvent(new CustomEvent('pantry:navstyle', { detail: id }))
}

// Locked to Frosted glass for everyone (v1.39.4, his call: the Profile picker is gone).
// A look saved on this device by the old picker is ignored, not migrated, so nothing
// else needs to change if it is ever brought back: point this at readNavStyle() again.
export function useNavStyle() {
  return getNavStyle(DEFAULT_NAV_STYLE)
}
