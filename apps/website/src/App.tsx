import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { DocsLayout } from '@/layouts/DocsLayout'
import { Home } from '@/pages/Home'
import { MainLayout } from './layouts/MainLayout'
import { Quickstart } from '@/docs/Quickstart'
import { ServerSdk } from '@/docs/ServerSdk'
import VerifyPage from './pages/VerifyPage'
import { Webhooks } from '@/docs/Webhooks'
import { Widget } from '@/docs/Widget'
import { WidgetEmbed } from '@/docs/WidgetEmbed'
import { useEffect } from 'react'

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

      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />

          <Route path="/docs" element={<DocsLayout />}>
            <Route index element={<Quickstart />} />
            <Route path="widget" element={<Widget />} />
            <Route path="widget-embed" element={<WidgetEmbed />} />
            <Route path="sdk" element={<ServerSdk />} />
            <Route path="webhooks" element={<Webhooks />} />
          </Route>
        </Route>

        <Route path="/verify" element={<VerifyPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
