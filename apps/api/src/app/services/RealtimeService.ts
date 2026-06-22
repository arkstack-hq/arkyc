import {
  type ChannelAuthResponse,
  type RealtimeConfig,
  type RealtimeDriver,
  RealtimeDriverFactory,
  type RealtimeDriverName,
} from '@arkyc/realtime'
import type { RealtimeTransport } from '@arkyc/types'
import { settings } from './GlobalSettingsService'

const env = process.env

/** Build a full driver config (credentials from env) for the named transport. */
function buildConfig(driver: RealtimeDriverName): RealtimeConfig {
  return {
    driver,
    soketi: {
      appId: env.SOKETI_APP_ID ?? 'arkyc',
      key: env.SOKETI_APP_KEY ?? 'arkyc-key',
      secret: env.SOKETI_APP_SECRET ?? 'arkyc-secret',
      host: env.SOKETI_HOST ?? '127.0.0.1',
      port: Number(env.SOKETI_PORT ?? 6001),
      useTLS: env.SOKETI_USE_TLS === 'true',
    },
    firebase: {
      projectId: env.FIREBASE_PROJECT_ID ?? '',
      clientEmail: env.FIREBASE_CLIENT_EMAIL ?? '',
      privateKey: (env.FIREBASE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
      databaseURL: env.FIREBASE_DATABASE_URL ?? '',
      apiKey: env.FIREBASE_API_KEY ?? '',
      authDomain: env.FIREBASE_AUTH_DOMAIN ?? '',
    },
  }
}

/** The env-configured transport. `memory` is a dev/test-only hard override. */
function envTransport(): RealtimeDriverName {
  return (env.REALTIME_TRANSPORT as RealtimeDriverName) ?? 'off'
}

const CACHE_TTL_MS = 10_000

/**
 * Resolves the active realtime driver and broadcasts events through it (Phase 16).
 *
 * The active transport is the platform `realtime.transport` setting, falling back
 * to `REALTIME_TRANSPORT` env when the setting is `off`. `memory` (dev/tests) is a
 * hard env override. The resolved driver is cached briefly and invalidated when
 * settings change, so toggling the transport takes effect promptly. Broadcasts are
 * fire-and-forget: a transport failure never breaks the request that triggered it.
 */
export class RealtimeService {
  private cached: { transport: RealtimeDriverName; driver: RealtimeDriver; at: number } | null = null

  /** Drop the cached driver so the next call re-resolves the transport. */
  invalidate(): void {
    this.cached = null
  }

  private async resolveTransport(): Promise<RealtimeDriverName> {
    const envT = envTransport()
    // `memory` is selectable only via env (not a real setting) — a dev/test override.
    if (envT === 'memory') return 'memory'

    let setting: RealtimeTransport = 'off'
    try {
      setting = (await settings.current()).realtime.transport
    } catch {
      // Settings unavailable (e.g. pre-migration) — fall back to env.
    }
    return setting !== 'off' ? setting : envT
  }

  private async driver(): Promise<RealtimeDriver> {
    const now = Date.now()
    if (this.cached && now - this.cached.at < CACHE_TTL_MS) return this.cached.driver

    const transport = await this.resolveTransport()
    if (this.cached?.transport === transport) {
      this.cached.at = now
      return this.cached.driver
    }

    const driver = RealtimeDriverFactory.create(buildConfig(transport))
    this.cached = { transport, driver, at: now }
    return driver
  }

  /** Fan an event out to channels. Fire-and-forget — never throws into the caller. */
  async broadcast(channels: readonly string[], event: string, payload: unknown): Promise<void> {
    if (channels.length === 0) return
    try {
      const driver = await this.driver()
      await driver.publish(channels, event, payload)
    } catch (error) {
      console.error('[realtime] publish failed:', (error as Error)?.message ?? error)
    }
  }

  /** Sign a private-channel subscription (Pusher protocol), or null if N/A. */
  async authorizeChannel(socketId: string, channel: string): Promise<ChannelAuthResponse | null> {
    const driver = await this.driver()
    return driver.authorizeChannel ? driver.authorizeChannel({ socketId, channel }) : null
  }

  /** The active transport name + public client connection params. */
  async clientConfig(): Promise<{ transport: RealtimeDriverName } & Record<string, unknown>> {
    const driver = await this.driver()
    return { transport: driver.name, ...driver.clientConfig() }
  }

  /** Mint a per-user client credential (Firebase custom token), or null. */
  async mintClientToken(uid: string, claims: Record<string, unknown>): Promise<string | null> {
    const driver = await this.driver()
    return driver.mintClientToken ? driver.mintClientToken(uid, claims) : null
  }
}

/** Shared singleton realtime service. */
export const realtime = new RealtimeService()
