import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

// Going back should put you where you were on that screen, not at the top of it.
// Positions are remembered per history entry (location.key), so two visits to the
// same page each keep their own spot. Going forward to a new screen starts at the top.
const positions = new Map()

export default function ScrollMemory() {
  const location = useLocation()
  const navType = useNavigationType()
  const keyRef = useRef(location.key)

  // Record continuously rather than on the way out: by the time a route change
  // commits, a shorter new page may already have clamped the scroll position.
  useEffect(() => {
    // Take over from the browser's own restoration, which fires before this SPA has
    // re-rendered the previous screen and so lands on the wrong spot.
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        // A scroll-locked page (an open overlay pins <body>) reports 0 here; don't
        // overwrite the real position with that.
        if (document.body.style.position !== 'fixed') positions.set(keyRef.current, window.scrollY)
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame) }
  }, [])

  const pathRef = useRef(location.pathname)

  useLayoutEffect(() => {
    keyRef.current = location.key
    const samePage = pathRef.current === location.pathname
    pathRef.current = location.pathname
    // Same screen, only the query changed (e.g. a friend's pantry overlay opening or
    // closing via ?friend=): leave scroll alone — the overlay's own scroll lock holds
    // and restores the page position, and fighting it here would jump the page.
    if (samePage) return
    if (navType !== 'POP') { window.scrollTo(0, 0); return }

    const target = positions.get(location.key) ?? 0
    // Lists can still be filling in on the first frame; retry briefly until the page is
    // tall enough to reach the saved spot, then stop.
    let tries = 0
    let frame = 0
    const attempt = () => {
      window.scrollTo(0, target)
      if (Math.abs(window.scrollY - target) > 2 && tries++ < 30) frame = requestAnimationFrame(attempt)
    }
    attempt()
    return () => cancelAnimationFrame(frame)
  }, [location.key, navType])

  return null
}
