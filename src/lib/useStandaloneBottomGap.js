import { useEffect, useState } from 'react'

// How far the real screen reaches below what `position: fixed; bottom: 0` treats as
// the bottom, in px. Normally 0.
//
// iOS home-screen apps (iOS 26.1 onward, WebKit bug 301994) report a viewport that's
// short by the status-bar height: window.innerHeight is screen height minus ~59px,
// and every `fixed inset-0` overlay is sized to that, leaving a strip of bare page
// background under its bottom edge. The page still paints there, so an overlay can
// close the strip by reaching down this far. Only iOS standalone (`navigator.standalone`)
// is measured: on Android, screen height includes the system nav bar, so the same
// sum would push content under it.
function measure() {
  if (typeof window === 'undefined' || window.navigator.standalone !== true) return 0
  const { innerWidth, innerHeight, screen } = window
  // iOS keeps screen.width/height in portrait terms, so pick the edge that matches now.
  const fullHeight = innerWidth > innerHeight
    ? Math.min(screen.width, screen.height)
    : Math.max(screen.width, screen.height)
  const gap = fullHeight - innerHeight
  // Anything bigger than a status bar isn't this bug; leave it alone.
  return gap > 0 && gap <= 100 ? gap : 0
}

export function useStandaloneBottomGap() {
  const [gap, setGap] = useState(measure)
  useEffect(() => {
    const update = () => setGap(measure())
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])
  return gap
}
