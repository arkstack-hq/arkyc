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
  const baseUrl = 'https://arkyc.toneflix.net'

  return (
    <StrictMode>
      <ScrollToTop />
      <meta property="og:image" content={`${baseUrl}/arkyc-banner.png`} />
      <meta property="twitter:image" content={`${baseUrl}/arkyc-banner.png`} />
      <Outlet />
    </StrictMode>
  )
}
