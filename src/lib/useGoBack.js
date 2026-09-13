import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

// "Close" everywhere in the app means: return to the screen you were on right before
// this one — a real history step back, not a jump to a hard-coded page. Jumping
// forward to a fixed route instead left duplicate entries behind, so the next back
// tap landed on the screen you had just closed.
//
// React Router's BrowserRouter keeps a per-entry index in history.state; idx 0 means
// this is the first page of the session (opened from a shared link, a bookmark, or a
// refresh), where stepping back would leave the app entirely — use the fallback then.
export function useGoBack() {
  const navigate = useNavigate()
  return useCallback((fallback = '/') => {
    const idx = window.history.state?.idx
    if (typeof idx === 'number' && idx > 0) navigate(-1)
    else navigate(fallback, { replace: true })
  }, [navigate])
}
