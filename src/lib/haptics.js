// Tiny haptic taps on the actions that feel physical — switching tabs, ticking an
// item off the grocery list, hearting a recipe.
//
// `navigator.vibrate` is Android/Chrome only; iOS Safari ignores it. That's fine:
// this is a garnish, never the feedback itself, so every call site still has a
// visual response. Guarded because the API is missing entirely in some webviews and
// throws if the page isn't user-activated.

function buzz(pattern) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern)
    }
  } catch {
    /* ignore — haptics are never load-bearing */
  }
}

// A light tick: tab switch, checkbox, toggle.
export const tap = () => buzz(8)

// A slightly heavier confirm: something was added or saved.
export const thud = () => buzz(18)
