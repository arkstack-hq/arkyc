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
  /** The client-token channel-auth endpoint (pusher). */
  authEndpoint: string
  /** The session's client token (sent as `X-Client-Token` to the authorizer). */
  token: string
}

/**
 * Import an optional transport SDK by a non-literal specifier so the bundler
 * leaves it as a runtime import (it isn't a hard dependency) and TypeScript
 * doesn't require its type declarations to be present.
 */
function loadOptional(specifier: string): Promise<unknown> {
  return import(/* @vite-ignore */ /* webpackIgnore: true */ specifier)
}

/**
 * Connect to whichever push transport the API reported for this session. Returns
 * null for `polling`/`off`/`memory` (no push — the widget polls instead) and also
 * when the transport SDK can't be loaded (e.g. a plain `<script>` standalone embed
 * with no bundler), so realtime degrades gracefully to polling. The SDK is
 * dynamically imported so only the active transport is ever pulled in.
 */
export async function createWidgetRealtimeClient(
  config: ClientRealtime,
  options: WidgetRealtimeOptions,
): Promise<WidgetRealtimeClient | null> {
  try {
    if (config.transport === 'pusher') return await createPusherClient(config, options)
    if (config.transport === 'firebase') return await createFirebaseClient(config)
  } catch {
    // Transport SDK unavailable / failed to connect — fall back to polling.
    return null
  }

  return null
}

// --- pusher-js (minimal surface we depend on) ---

interface PusherChannel {
  bind_global(cb: (event: string, data: unknown) => void): void
  unbind_global(cb: (event: string, data: unknown) => void): void
}
interface PusherInstance {
  subscribe(channel: string): PusherChannel
  unsubscribe(channel: string): void
  disconnect(): void
}
type PusherCtor = new (key: string, options: Record<string, unknown>) => PusherInstance

async function createPusherClient(
  config: ClientRealtime,
  options: WidgetRealtimeOptions,
): Promise<WidgetRealtimeClient> {
  const mod = (await loadOptional('pusher-js')) as { default: PusherCtor }
  const Pusher = mod.default
  const pusher = new Pusher(String(config.key ?? ''), {
    cluster: String(config.cluster ?? 'mt1'),
    forceTLS: Boolean(config.forceTLS ?? false),
    ...(config.wsHost
      ? {
          wsHost: String(config.wsHost),
          wsPort: Number(config.wsPort),
          wssPort: Number(config.wssPort ?? config.wsPort),
          enabledTransports: (config.enabledTransports as string[]) ?? ['ws', 'wss'],
        }
      : {}),
    // The widget authorizes private channels with its short-lived client token,
    // which the API scopes to this session's own channel only.
    channelAuthorization: {
      transport: 'ajax',
      endpoint: options.authEndpoint,
      headers: { 'X-Client-Token': options.token },
    },
  })

  return {
    subscribe(channel, handler) {
      const ch = pusher.subscribe(channel)
      const cb = (event: string, data: unknown) => handler(event, data)
      ch.bind_global(cb)

      return () => {
        ch.unbind_global(cb)
        pusher.unsubscribe(channel)
      }
    },
    disconnect() {
      pusher.disconnect()
    },
  }
}

// --- firebase (minimal surface we depend on) ---

interface FirebaseApp {
  name: string
}
interface FirebaseAppModule {
  initializeApp(options: Record<string, unknown>, name: string): FirebaseApp
  getApps(): FirebaseApp[]
  getApp(name: string): FirebaseApp
}
interface FirebaseAuthModule {
  getAuth(app: FirebaseApp): unknown
  signInWithCustomToken(auth: unknown, token: string): Promise<unknown>
}
interface FirebaseSnapshot {
  val(): { event: string; payload: unknown } | null
}
interface FirebaseDatabaseModule {
  getDatabase(app: FirebaseApp): unknown
  ref(db: unknown, path: string): unknown
  query(ref: unknown, ...constraints: unknown[]): unknown
  orderByChild(path: string): unknown
  startAt(value: number): unknown
  onChildAdded(query: unknown, cb: (snap: FirebaseSnapshot) => void): () => void
}

async function createFirebaseClient(config: ClientRealtime): Promise<WidgetRealtimeClient> {
  const [app, auth, database] = (await Promise.all([
    loadOptional('firebase/app'),
    loadOptional('firebase/auth'),
    loadOptional('firebase/database'),
  ])) as [FirebaseAppModule, FirebaseAuthModule, FirebaseDatabaseModule]

  const name = 'arkyc-widget-realtime'
  const fbApp = app.getApps().some((a) => a.name === name)
    ? app.getApp(name)
    : app.initializeApp(
        {
          apiKey: String(config.apiKey ?? ''),
          authDomain: String(config.authDomain ?? ''),
          projectId: String(config.projectId ?? ''),
          databaseURL: String(config.databaseURL ?? ''),
        },
        name,
      )

  // The per-session custom token authorizes reads of this session's channel only.
  if (config.token) await auth.signInWithCustomToken(auth.getAuth(fbApp), config.token)

  const db = database.getDatabase(fbApp)
  const since = Date.now()

  return {
    subscribe(channel, handler) {
      const q = database.query(
        database.ref(db, `realtime/${channel}`),
        database.orderByChild('at'),
        database.startAt(since),
      )
      const unsubscribe = database.onChildAdded(q, (snap) => {
        const value = snap.val()
        if (value) handler(value.event, value.payload)
      })

      return () => unsubscribe()
    },
    disconnect() {
      // Firebase listeners are torn down per-subscription via the returned unsub.
    },
  }
}
