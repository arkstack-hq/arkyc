import { useEffect, useRef, useState } from 'react'

import { ArkycWidget } from '@arkyc/widget'
import type { WidgetResult } from '@arkyc/types'
import { env } from '@/config/environment'

/** The widget's Client API base — it appends `/session`, `/document/front`, … to this. */
const API_BASE = env('VITE_API_URL', '') + '/api/v1/client'

interface Outcome {
  title: string
  message: string
}

/** The finalizer shown after the widget settles on this hosted page. */
function completionOutcome(status: WidgetResult['status']): Outcome {
  if (status === 'requires_review') {
    return { title: 'Submitted', message: 'Your verification is being reviewed. You can close this window.' }
  }
  if (status === 'rejected') {
    return { title: 'All done', message: 'This verification is complete. You can close this window.' }
  }
  return { title: 'All done', message: 'Your identity has been verified. You can close this window.' }
}

/**
 * First-party hosted verification page (`/verify`). The cross-device handoff QR
 * shown on a desktop points here with the session `?token=`; this page resumes
 * the same session on the phone, full-screen. `handoff` is disabled so the phone
 * doesn't offer to hand off again. When the widget settles, we replace its overlay
 * with a success/close screen so the page never falls back to a blank screen.
 */
export default function VerifyPage() {
  const [{ token, baseUrl }] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    // Prefer the baseUrl the QR carried (custom hosting); else this app's API.
    return { token: params.get('token') ?? '', baseUrl: params.get('baseUrl') ?? API_BASE }
  })
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  // StrictMode mounts the effect twice; its cleanup closes the widget, which fires
  // onClose. Flag the teardown so that synthetic close doesn't show the end screen.
  const tearingDown = useRef(false)

  useEffect(() => {
    if (!token) return
    tearingDown.current = false
    const handle = ArkycWidget.open({
      token,
      baseUrl,
      fullscreen: true,
      handoff: false,
      onComplete: (result) => setOutcome(completionOutcome(result.status)),
      onError: () =>
        setOutcome({ title: 'Something went wrong', message: 'Please reopen the link from your other device.' }),
      onClose: () => {
        if (!tearingDown.current) {
          setOutcome((current) => current ?? { title: 'Closed', message: 'You can close this window.' })
        }
      },
    })
    return () => {
      tearingDown.current = true
      handle.close()
    }
  }, [token, baseUrl])

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-muted-foreground">
        This verification link is missing its session token.
      </div>
    )
  }

  if (outcome) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-lg font-semibold">{outcome.title}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">{outcome.message}</p>
        <button
          type="button"
          onClick={() => window.close()}
          className="mt-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Close
        </button>
      </div>
    )
  }

  // The widget mounts itself as a full-screen overlay on the document body.
  return <div className="min-h-screen bg-background" />
}
