import { useEffect, useRef, useState } from 'react'
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
  const started = useRef(false)
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token') ?? '')

  useEffect(() => {
    if (!token || started.current) return
    started.current = true
    const handle = ArkycWidget.open({
      token,
      // Prefer the baseUrl the QR carried (custom hosting); else this app's API.
      baseUrl: new URLSearchParams(window.location.search).get('baseUrl') ?? API_BASE,
      fullscreen: true,
      handoff: false,
    })
    return () => handle.close()
  }, [token])

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
