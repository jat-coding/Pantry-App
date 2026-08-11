import { useEffect } from 'react'

// Freeze the page behind a full-screen overlay for as long as it's mounted.
//
// Without this, a touch scroll inside the overlay "chains" to the document
// once the overlay reaches its own top or bottom: the page behind moves, and
// closing the overlay leaves you somewhere you never scrolled to. Pair it with
// `overscroll-contain` on the scrollable element — that class stops the chain
// at the boundary, while this stops the page moving at all.
//
// `position: fixed` is used rather than the simpler `overflow: hidden`, which
// iOS Safari ignores on <body>. Because fixing the body would otherwise jump
// the page to the top, the current offset is preserved and restored on unmount.
export function useScrollLock() {
  useEffect(() => {
    const { body } = document
    const scrollY = window.scrollY
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      overflow: body.style.overflow,
    }

    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.overflow = 'hidden'

    return () => {
      Object.assign(body.style, previous)
      // Restoring position removes the offset, so put the page back where it was.
      window.scrollTo(0, scrollY)
    }
  }, [])
}
