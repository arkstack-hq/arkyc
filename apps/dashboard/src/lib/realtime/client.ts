import type { RealtimeTransport } from '@arkyc/types'

/** The connection params `/v1/realtime/config` returns for the active transport. */
export interface RealtimeConnectionConfig {
  transport: RealtimeTransport | 'memory'
  // soketi (Pusher-compatible)
  key?: string
  wsHost?: string
  wsPort?: number
  wssPort?: number
  forceTLS?: boolean
  cluster?: string
  enabledTransports?: string[]
  // firebase
  apiKey?: string
  authDomain?: string
  projectId?: string
  databaseURL?: string
  token?: string | null
}

export type RealtimeHandler = (event: string, data: unknown) => void

/** A connected realtime client. `subscribe` returns an unsubscribe function. */
export interface RealtimeClient {
  subscribe(channel: string, handler: RealtimeHandler): () => void
  disconnect(): void
}

interface ClientOptions {
  authEndpoint: string
  authToken: () => string | null
}

/**
 * Connect to whichever transport the API reports. Returns null for `off`/`memory`
 * (no live transport). The transport SDK is dynamically imported so only the
 * active one is ever loaded into the bundle at runtime.
 */
export async function createRealtimeClient(
  config: RealtimeConnectionConfig,
  options: ClientOptions,
): Promise<RealtimeClient | null> {
  if (config.transport === 'pusher') return createPusherClient(config, options)
  if (config.transport === 'firebase') return createFirebaseClient(config)
  return null
}

async function createPusherClient(config: RealtimeConnectionConfig, options: ClientOptions): Promise<RealtimeClient> {
  const { default: Pusher } = await import('pusher-js')
  // Hosted Pusher connects via `cluster`; self-hosted soketi adds a `wsHost`.
  const pusher = new Pusher(config.key ?? '', {
    cluster: config.cluster ?? 'mt1',
    forceTLS: config.forceTLS ?? false,
    ...(config.wsHost
      ? {
          wsHost: config.wsHost,
          wsPort: config.wsPort,
          wssPort: config.wssPort ?? config.wsPort,
          enabledTransports: (config.enabledTransports as ('ws' | 'wss')[]) ?? ['ws', 'wss'],
        }
      : {}),
    channelAuthorization: {
      transport: 'ajax',
      endpoint: options.authEndpoint,
      headers: { Authorization: `Bearer ${options.authToken() ?? ''}` },
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

async function createFirebaseClient(config: RealtimeConnectionConfig): Promise<RealtimeClient> {
  const [{ initializeApp, getApps, getApp }, { getAuth, signInWithCustomToken }, database] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/database'),
  ])
  const { getDatabase, ref, query, orderByChild, startAt, onChildAdded } = database

  const name = 'arkyc-realtime'
  const fbApp = getApps().some((a) => a.name === name)
    ? getApp(name)
    : initializeApp(
        {
          apiKey: config.apiKey,
          authDomain: config.authDomain,
          projectId: config.projectId,
          databaseURL: config.databaseURL,
        },
        name,
      )

  if (config.token) await signInWithCustomToken(getAuth(fbApp), config.token)

  const db = getDatabase(fbApp)
  // Only events published from now on (ignore the channel's backlog).
  const since = Date.now()

  return {
    subscribe(channel, handler) {
      const q = query(ref(db, `realtime/${channel}`), orderByChild('at'), startAt(since))
      const unsubscribe = onChildAdded(q, (snap) => {
        const value = snap.val() as { event: string; payload: unknown } | null
        if (value) handler(value.event, value.payload)
      })
      return () => unsubscribe()
    },
    disconnect() {
      // Firebase listeners are torn down per-subscription via the returned unsub.
    },
  }
}
