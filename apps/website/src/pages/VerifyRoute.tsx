import { Suspense, lazy } from 'react'

import { ClientOnly } from 'vite-react-ssg'

const VerifyPage = lazy(() => import('./VerifyPage'))

/**
 * Client-only wrapper for the verification page. It runs the widget and reads
 * `window`, so it renders nothing during prerender (producing a lightweight
 * `verify.html` shell) and mounts on the client, where the widget chunk loads
 * lazily. This keeps the widget out of both the SSR render and the main bundle.
 */
export default function VerifyRoute() {
  return (
    <ClientOnly fallback={null}>
      {() => (
        <Suspense fallback={null}>
          <VerifyPage />
        </Suspense>
      )}
    </ClientOnly>
  )
}
