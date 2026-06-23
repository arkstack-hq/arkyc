/** Identifier for a registered realtime driver. */
export type RealtimeDriverName = 'pusher' | 'firebase' | 'polling' | 'memory' | 'off'

/**
 * Pusher connection parameters. By default addresses hosted Pusher Channels via
 * `cluster`; setting `host` opts into a self-hosted soketi instance (host/port).
 */
export interface PusherConfig {
  appId: string
  key: string
  secret: string
  useTLS: boolean
  /** Hosted Pusher cluster (e.g. `eu`, `us2`). Ignored when `host` is set. */
  cluster: string
  /** Self-hosted soketi host (opt-in). When set, addressing uses host/port. */
  host?: string
  port?: number
}

/** Firebase (Realtime Database) connection parameters. */
export interface FirebaseConfig {
  projectId: string
  clientEmail: string
  privateKey: string
  databaseURL: string
  /** Public web config the browser client needs to connect. */
  apiKey: string
  authDomain: string
}

/** Configuration selecting + parameterising the active realtime driver. */
export interface RealtimeConfig {
  driver: RealtimeDriverName
  pusher?: PusherConfig
  firebase?: FirebaseConfig
}

/** A request to authorize a private-channel subscription (Pusher protocol). */
export interface ChannelAuthRequest {
  socketId: string
  channel: string
}

/** The signed auth response a Pusher-compatible client expects. */
export interface ChannelAuthResponse {
  auth: string
  [key: string]: unknown
}

/**
 * A pluggable realtime broadcaster. The API publishes events through this; the
 * concrete driver (pusher/firebase) is chosen at runtime by the global setting.
 */
export interface RealtimeDriver {
  readonly name: RealtimeDriverName

  /** Fan a single event out to one or more channels. Must not throw on transport errors. */
  publish(channels: readonly string[], event: string, payload: unknown): Promise<void>

  /**
   * Public connection parameters the browser client needs to connect to this
   * transport (e.g. Pusher key/host, or Firebase web config). Never includes secrets.
   */
  clientConfig(): Record<string, unknown>

  /**
   * Sign a private-channel subscription (Pusher protocol). Returns null for
   * drivers that don't use server-signed channel auth (firebase/off). Async so a
   * driver can lazy-load its transport SDK only when actually used.
   */
  authorizeChannel?(request: ChannelAuthRequest): Promise<ChannelAuthResponse | null>

  /**
   * Mint a per-user client credential, if the driver needs one (e.g. a Firebase
   * custom token carrying organization claims). Returns null otherwise.
   */
  mintClientToken?(uid: string, claims: Record<string, unknown>): Promise<string | null>
}
