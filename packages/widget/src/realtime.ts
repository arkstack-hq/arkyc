import { createRealtime, type ModuleImporter, type RealtimeConfig } from '@arkstack/realtime'
import { REALTIME_EVENT } from '@arkyc/types'
import type { ClientRealtime } from './client'

/** Fires for every event received on a subscribed channel. */
export type WidgetRealtimeHandler = (event: string, data: unknown) => void

/** A connected push transport. `subscribe` returns an unsubscribe function. */
export interface WidgetRealtimeClient {
  subscribe(channel: string, handler: WidgetRealtimeHandler): () => void
  disconnect(): void
}

/** A factory that builds a push client from the session's realtime config. */
export type WidgetRealtimeFactory = (
  config: ClientRealtime,
  options: WidgetRealtimeOptions,
) => Promise<WidgetRealtimeClient | null>

export interface WidgetRealtimeOptions {
  /** The client-token channel-auth endpoint. */
  authEndpoint: string
  /** The session's client token (sent as `X-Client-Token` to the authorizer). */
  token: string
}

/** CDN that serves any npm package as ESM (`…/pkg@ver/+esm`). */
const CDN = 'https://cdn.jsdelivr.net/npm/'

/** CDN paths for the SDK modules the realtime transports load. */
const CDN_PATHS: Record<string, string> = {
  'pusher-js': 'pusher-js@8/+esm',
  'firebase/app': 'firebase@11/app/+esm',
  'firebase/auth': 'firebase@11/auth/+esm',
  'firebase/database': 'firebase@11/database/+esm',
  'firebase/messaging': 'firebase@11/messaging/+esm',
}

/** The domain events the widget watches its session for. */
const SESSION_EVENTS = [REALTIME_EVENT.sessionTransition]

/**
 * Load a transport SDK by its package name (resolved by a bundler, import map or
 * Node), falling back to jsDelivr so a plain `<script>` embed still gets it.
 *
 * @param specifier
 * @returns
 */
export const importWithCdnFallback: ModuleImporter = async (specifier) => {
  try {
    return await import(/* @vite-ignore */ /* webpackIgnore: true */ specifier)
  } catch (error) {
    const path = CDN_PATHS[specifier]
    if (!path) throw error

    return await import(/* @vite-ignore */ /* webpackIgnore: true */ `${CDN}${path}`)
  }
}

/**
 * Connect to the session's push transport. Returns null for transports the
 * widget does not stream over (polling, and Firebase Cloud Messaging, which
 * would prompt the end user for notification permission), and rejects when the
 * transport SDK cannot load, so the caller polls instead.
 *
 * @param config
 * @param options
 * @returns
 */
export async function createWidgetRealtimeClient(
  config: ClientRealtime,
  options: WidgetRealtimeOptions,
): Promise<WidgetRealtimeClient | null> {
  if (config.transport !== 'pusher' && config.transport !== 'firebase-database') return null

  const authEndpoint = options.authEndpoint
  const auth = { headers: { 'X-Client-Token': options.token } }
  const pusher = config.pusher as RealtimeConfig['pusher']
  const firebaseDatabase = config['firebase-database'] as RealtimeConfig['firebase-database']

  const client = createRealtime({
    transport: config.transport,
    pusher: pusher && { ...pusher, authEndpoint, auth },
    'firebase-database': firebaseDatabase && { ...firebaseDatabase, authEndpoint, auth },
    importModule: importWithCdnFallback,
  })

  // Connect now, so a transport that cannot load falls back to polling.
  await client.onPoll(() => {})

  return {
    subscribe(channel, handler) {
      let active = true
      const stops: Array<() => void> = []

      for (const event of SESSION_EVENTS) {
        client
          .listen(channel, event, (data) => handler(event, data))
          .then((stop) => (active ? stops.push(stop) : stop()))
          .catch(() => {
            // An unauthorized or unavailable channel leaves the session to the poll budget.
          })
      }

      return () => {
        active = false
        stops.forEach((stop) => stop())
      }
    },
    disconnect() {
      void client.disconnect()
    },
  }
}
