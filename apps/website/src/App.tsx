import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Nav } from '@/components/Nav'
import { Footer } from '@/components/Footer'
import { Home } from '@/pages/Home'
import { DocsLayout } from '@/docs/DocsLayout'
import { Quickstart } from '@/docs/Quickstart'
import { Widget } from '@/docs/Widget'
import { ServerSdk } from '@/docs/ServerSdk'
import { Webhooks } from '@/docs/Webhooks'

/** Scroll to top on route change, unless navigating to a hash anchor. */
function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0)
  }, [pathname, hash])
  return null
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Nav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/docs" element={<DocsLayout />}>
          <Route index element={<Quickstart />} />
          <Route path="widget" element={<Widget />} />
          <Route path="sdk" element={<ServerSdk />} />
          <Route path="webhooks" element={<Webhooks />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Footer />
    </>
  )
}
