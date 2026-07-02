import { Outlet, useLocation } from 'react-router-dom'
import { StrictMode, useEffect } from 'react'

/** Scroll to top on route change, unless navigating to a hash anchor. */
function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0)
  }, [pathname, hash])

  return null
}

/** The app shell rendered for every route (prerendered per route by vite-react-ssg). */
export function RootLayout() {
  return (
    <StrictMode>
      <ScrollToTop />
      <Outlet />
    </StrictMode>
  )
}
