import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useRequest } from 'alova/client'
import { Realtime } from '@/lib/api'
import { type RealtimeClient, type RealtimeHandler, createRealtimeClient } from '@/lib/realtime/client'
import { AUTH_TOKEN_KEY } from '@/lib/requests/alova'
import { env } from '@/config/environment'

interface RealtimeState {
  /** Resolves to the connected client, or null when realtime is off/unsupported. */
  client: Promise<RealtimeClient | null>
}

const RealtimeContext = createContext<RealtimeState | null>(null)

/**
 * Connects to the active realtime transport (discovered from `/realtime/config`)
 * and exposes it to {@link useRealtimeChannel}. A no-op when the transport is
 * `off` — the app still works via the existing cache-invalidation paths.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { data: config } = useRequest(Realtime.config())
  const [client, setClient] = useState<Promise<RealtimeClient | null>>(() => Promise.resolve(null))

  useEffect(() => {
    if (!config) return
    const promise = createRealtimeClient(config, {
      authEndpoint: `${env('VITE_API_URL', '')}/api/v1/realtime/auth`,
      authToken: () => localStorage.getItem(AUTH_TOKEN_KEY),
    })
    setClient(promise)
    return () => {
      void promise.then((c) => c?.disconnect())
    }
  }, [config])

  return <RealtimeContext.Provider value={{ client }}>{children}</RealtimeContext.Provider>
}

/**
 * Subscribe to a private channel while mounted. `handler` fires for every event
 * on the channel; the latest handler is always used (no resubscribe churn).
 * No-ops when there is no channel or the transport is off.
 */
export function useRealtimeChannel(channel: string | null, handler: RealtimeHandler): void {
  const ctx = useContext(RealtimeContext)
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!ctx || !channel) return
    let active = true
    let unsubscribe: (() => void) | null = null

    void ctx.client.then((client) => {
      if (!client || !active) return
      unsubscribe = client.subscribe(channel, (event, data) => handlerRef.current(event, data))
    })

    return () => {
      active = false
      unsubscribe?.()
    }
  }, [ctx, channel])
}
