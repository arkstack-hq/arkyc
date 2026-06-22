import type { ChannelAuthRequest, ChannelAuthResponse, RealtimeDriver } from '../types'

/** A no-op driver. Realtime is disabled; `publish` does nothing. */
export class OffRealtimeDriver implements RealtimeDriver {
  readonly name = 'off' as const

  async publish(): Promise<void> {
    // intentionally no-op
  }

  clientConfig(): Record<string, unknown> {
    return {}
  }

  async authorizeChannel(_request: ChannelAuthRequest): Promise<ChannelAuthResponse | null> {
    return null
  }
}
