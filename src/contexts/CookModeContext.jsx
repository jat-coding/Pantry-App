import { createContext, useContext, useState } from 'react'

// Whether Cook Mode is active on the recipe detail page. Lives above Layout
// so the bottom tab bar (an ancestor of the page that turns it on) can hide
// itself — Cook Mode's own Prev/Next bar is the only bottom control while it's on.
const CookModeContext = createContext({ cookMode: false, setCookMode: () => {} })

export function CookModeProvider({ children }) {
  const [cookMode, setCookMode] = useState(false)
  return (
    <CookModeContext.Provider value={{ cookMode, setCookMode }}>
      {children}
    </CookModeContext.Provider>
  )
}

export function useCookMode() {
  return useContext(CookModeContext)
}
