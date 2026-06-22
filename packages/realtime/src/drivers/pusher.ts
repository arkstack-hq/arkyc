import type { ChannelAuthRequest, ChannelAuthResponse, PusherConfig, RealtimeDriver } from '../types'

/** The slice of the `pusher` server client we use. */
interface PusherClient {
  trigger(channels: string[], event: string, data: unknown): Promise<unknown>
  authorizeChannel(socketId: string, channel: string): ChannelAuthResponse
}

/**
 * Pusher driver — publishes via the Pusher HTTP API (signed server triggers) and
 * signs private-channel subscriptions. Targets hosted Pusher Channels by default
 * (via `cluster`); set `host` to point at a self-hosted soketi instead. The
 * `pusher` SDK is dynamically imported so it only loads when this is the active
 * transport.
 */
export class PusherRealtimeDriver implements RealtimeDriver {
  readonly name = 'pusher' as const

  private client: PusherClient | null = null

  constructor(private readonly config: PusherConfig) {}

  private async pusher(): Promise<PusherClient> {
    if (this.client) return this.client
    const mod = (await import('pusher')) as unknown as {
      default: new (opts: Record<string, unknown>) => PusherClient
    }
    const Pusher = mod.default
    // Self-hosted soketi addresses by host/port; hosted Pusher by cluster.
    const options = this.config.host
      ? {
          appId: this.config.appId,
          key: this.config.key,
          secret: this.config.secret,
          host: this.config.host,
          port: String(this.config.port ?? 6001),
          useTLS: this.config.useTLS,
        }
      : {
          appId: this.config.appId,
          key: this.config.key,
          secret: this.config.secret,
          cluster: this.config.cluster,
          useTLS: this.config.useTLS,
        }
    this.client = new Pusher(options)
    return this.client
  }

  async publish(channels: readonly string[], event: string, payload: unknown): Promise<void> {
    if (channels.length === 0) return
    const client = await this.pusher()
    await client.trigger([...channels], event, payload)
  }

  clientConfig(): Record<string, unknown> {
    if (this.config.host) {
      // Self-hosted soketi: pusher-js needs an explicit ws host (cluster is unused
      // but still required by the client, so we pass a placeholder).
      return {
        key: this.config.key,
        wsHost: this.config.host,
        wsPort: this.config.port,
        wssPort: this.config.port,
        forceTLS: this.config.useTLS,
        enabledTransports: ['ws', 'wss'],
        cluster: this.config.cluster || 'mt1',
      }
    }
    // Hosted Pusher: the cluster is enough — pusher-js derives the host from it.
    return {
      key: this.config.key,
      cluster: this.config.cluster,
      forceTLS: this.config.useTLS,
    }
  }

  async authorizeChannel(request: ChannelAuthRequest): Promise<ChannelAuthResponse> {
    const client = await this.pusher()
    return client.authorizeChannel(request.socketId, request.channel)
  }
}
