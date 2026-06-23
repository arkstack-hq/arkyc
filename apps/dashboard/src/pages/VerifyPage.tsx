import { useEffect, useState } from 'react'

import { ArkycWidget } from '@arkyc/widget'
import { env } from '@/config/environment'

/** API origin + `/api`, matching the dashboard's alova baseURL. */
const API_BASE = env('VITE_API_URL', '') + '/api'

/**
 * First-party hosted verification page (`/verify`). The cross-device handoff QR
 * shown on a desktop points here with the session `?token=`; this page resumes
 * the same session on the phone, full-screen. `handoff` is disabled so the phone
 * doesn't offer to hand off again.
 */
export default function VerifyPage() {
  const [{ token, baseUrl }] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    // Prefer the baseUrl the QR carried (custom hosting); else this app's API.
    return { token: params.get('token') ?? '', baseUrl: params.get('baseUrl') ?? API_BASE }
  })

  useEffect(() => {
    if (!token) return
    // No mount guard: the cleanup closes the widget, so React's StrictMode
    // double-invoke (mount → cleanup → mount) settles on a single open widget.
    // A persistent ref guard would survive the first cleanup and block reopening.
    const handle = ArkycWidget.open({ token, baseUrl, fullscreen: true, handoff: false })
    return () => handle.close()
  }, [token, baseUrl])

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-muted-foreground">
        This verification link is missing its session token.
      </div>
    )
  }
  // The widget mounts itself as a full-screen overlay on the document body.
  return <div className="min-h-screen bg-background" />
}
