import { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { useRequest } from 'alova/client'
import type { RealtimeClient } from '@arkstack/realtime'
import { REALTIME_EVENT } from '@arkyc/types'
import { Realtime } from '@/lib/api'
import { createRealtimeClient } from '@/lib/realtime/client'
import { AUTH_TOKEN_KEY } from '@/lib/requests/alova'
import { env } from '@/config/environment'

/** Called with the event name and its payload, or `'poll'` when the transport is polling. */
export type RealtimeHandler = (event: string, data: unknown) => void

interface RealtimeState {
  client: RealtimeClient | null
}

export const RealtimeContext = createContext<RealtimeState>({ client: null })

/** The domain events dashboard views refresh on. */
const DOMAIN_EVENTS = Object.values(REALTIME_EVENT)

/**
 * Connects to the API's realtime transport (discovered from `/realtime/config`)
 * and shares the client with {@link useRealtimeChannel}.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { data: config } = useRequest(Realtime.config())

  const client = useMemo(
    () =>
      config
        ? createRealtimeClient(config, {
            apiBase: `${env('VITE_API_URL', '')}/api`,
            token: localStorage.getItem(AUTH_TOKEN_KEY),
          })
        : null,
    [config],
  )

  useEffect(() => {
    return () => {
      void client?.disconnect()
    }
  }, [client])

  return <RealtimeContext.Provider value={{ client }}>{children}</RealtimeContext.Provider>
}

/** The connected realtime client, or null until the config has loaded. */
export function useRealtime(): RealtimeClient | null {
  return useContext(RealtimeContext).client
}

/**
 * Run `handler` for `events` on a private channel while mounted. Under the
 * polling transport it runs on the advertised interval instead, so a view can
 * refetch either way. The latest handler is always used.
 *
 * @param channel  Null to skip.
 * @param handler
 * @param events   Defaults to the session and review domain events.
 */
export function useRealtimeChannel(
  channel: string | null,
  handler: RealtimeHandler,
  events: readonly string[] = DOMAIN_EVENTS,
): void {
  const client = useRealtime()
  const handlerRef = useRef(handler)
  handlerRef.current = handler
  const eventKey = events.join('|')

  useEffect(() => {
    if (!client || !channel) return

    let active = true
    const stops: Array<() => void> = []
    const keep = (stop: () => void) => {
      if (active) stops.push(stop)
      else stop()
    }

    for (const event of eventKey.split('|')) {
      client
        .listen(channel, event, (data) => handlerRef.current(event, data))
        .then(keep)
        .catch(() => {
          // A channel the transport cannot join leaves the view on manual refresh.
        })
    }

    client
      .onPoll(() => handlerRef.current('poll', undefined))
      .then(keep)
      .catch(() => {})

    return () => {
      active = false
      stops.forEach((stop) => stop())
    }
  }, [client, channel, eventKey])
}
