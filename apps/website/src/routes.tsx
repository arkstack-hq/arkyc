import type { RouteRecord } from 'vite-react-ssg'
import { Navigate } from 'react-router-dom'

import { DocsLayout } from '@/layouts/DocsLayout'
import { ErrorCodes } from '@/docs/ErrorCodes'
import { Home } from '@/pages/Home'
import { MainLayout } from '@/layouts/MainLayout'
import { Quickstart } from '@/docs/Quickstart'
import { RootLayout } from './RootLayout'
import { ServerSdk } from '@/docs/ServerSdk'
import { VerificationLifecycle } from '@/docs/VerificationLifecycle'
import VerifyRoute from './pages/VerifyRoute'
import { Webhooks } from '@/docs/Webhooks'
import { Widget } from '@/docs/Widget'
import { WidgetEmbed } from '@/docs/WidgetEmbed'

/**
 * The route tree, as data-router records so vite-react-ssg can prerender each
 * path to static HTML. The docs and marketing routes are fully static; `/verify`
 * is client-only (it runs the widget and reads `window`), so it's lazy-loaded to
 * keep it out of the prerender graph and excluded from prerendering in
 * `vite.config.ts`.
 */
export const routes: RouteRecord[] = [
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        element: <MainLayout />,
        children: [
          { index: true, element: <Home /> },
          {
            path: 'docs',
            element: <DocsLayout />,
            children: [
              { index: true, element: <Quickstart /> },
              { path: 'widget', element: <Widget /> },
              { path: 'widget-embed', element: <WidgetEmbed /> },
              { path: 'sdk', element: <ServerSdk /> },
              { path: 'webhooks', element: <Webhooks /> },
              { path: 'lifecycle', element: <VerificationLifecycle /> },
              { path: 'errors', element: <ErrorCodes /> },
            ],
          },
        ],
      },
      { path: 'verify', element: <VerifyRoute /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]
