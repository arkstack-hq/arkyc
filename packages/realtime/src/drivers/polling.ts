import type { ChannelAuthRequest, ChannelAuthResponse, RealtimeDriver } from '../types'

/**
 * Polling driver — there is no push transport. The server publishes nothing;
 * clients discover this via `clientConfig().transport === 'polling'` and fall
 * back to polling the session endpoint themselves. A universal, zero-infra
 * delivery mode (distinct from `off`, which disables live updates entirely).
 */
export class PollingRealtimeDriver implements RealtimeDriver {
  readonly name = 'polling' as const

  async publish(): Promise<void> {
    // intentionally no-op — clients poll instead of receiving pushes.
  }

  clientConfig(): Record<string, unknown> {
    return {}
  }

  async authorizeChannel(_request: ChannelAuthRequest): Promise<ChannelAuthResponse | null> {
    return null
  }
}
