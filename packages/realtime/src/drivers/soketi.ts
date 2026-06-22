import type { ChannelAuthRequest, ChannelAuthResponse, RealtimeDriver, SoketiConfig } from '../types'

/** The slice of the `pusher` server client we use (soketi is Pusher-compatible). */
interface PusherClient {
  trigger(channels: string[], event: string, data: unknown): Promise<unknown>
  authorizeChannel(socketId: string, channel: string): ChannelAuthResponse
}

/**
 * Soketi driver — publishes via the Pusher HTTP API (signed server triggers) and
 * signs private-channel subscriptions. The `pusher` SDK is dynamically imported
 * so it only loads when soketi is the active transport.
 */
export class SoketiRealtimeDriver implements RealtimeDriver {
  readonly name = 'soketi' as const

  private client: PusherClient | null = null

  constructor(private readonly config: SoketiConfig) {}

  private async pusher(): Promise<PusherClient> {
    if (this.client) return this.client
    const mod = (await import('pusher')) as unknown as {
      default: new (opts: Record<string, unknown>) => PusherClient
    }
    const Pusher = mod.default
    this.client = new Pusher({
      appId: this.config.appId,
      key: this.config.key,
      secret: this.config.secret,
      host: this.config.host,
      port: String(this.config.port),
      useTLS: this.config.useTLS,
    })
    return this.client
  }

  async publish(channels: readonly string[], event: string, payload: unknown): Promise<void> {
    if (channels.length === 0) return
    const client = await this.pusher()
    await client.trigger([...channels], event, payload)
  }

  clientConfig(): Record<string, unknown> {
    return {
      key: this.config.key,
      wsHost: this.config.host,
      wsPort: this.config.port,
      wssPort: this.config.port,
      forceTLS: this.config.useTLS,
      enabledTransports: ['ws', 'wss'],
      // soketi ignores cluster, but pusher-js requires one of cluster/wsHost.
      cluster: 'mt1',
    }
  }

  async authorizeChannel(request: ChannelAuthRequest): Promise<ChannelAuthResponse> {
    const client = await this.pusher()
    return client.authorizeChannel(request.socketId, request.channel)
  }
}
