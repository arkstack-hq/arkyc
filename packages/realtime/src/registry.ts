import type { RealtimeConfig, RealtimeDriver } from './types'

import { FirebaseRealtimeDriver } from './drivers/firebase'
import { MemoryRealtimeDriver } from './drivers/memory'
import { OffRealtimeDriver } from './drivers/off'
import { PollingRealtimeDriver } from './drivers/polling'
import { PusherRealtimeDriver } from './drivers/pusher'

/** Selects a realtime driver from config. */
export class RealtimeDriverFactory {
  /**
   * Resolve the realtime driver named by `config`. Missing credentials for the
   * selected driver fall back to the no-op `off` driver so a misconfigured
   * environment never breaks the request that triggered the broadcast.
   *
   * @param config
   * @returns
   */
  static create(config: RealtimeConfig): RealtimeDriver {
    switch (config.driver) {
      case 'pusher':
        return config.pusher ? new PusherRealtimeDriver(config.pusher) : new OffRealtimeDriver()
      case 'firebase':
        return config.firebase ? new FirebaseRealtimeDriver(config.firebase) : new OffRealtimeDriver()
      case 'polling':
        return new PollingRealtimeDriver()
      case 'memory':
        return new MemoryRealtimeDriver()
      case 'off':
      case false as never:
      case 'false' as never:
        return new OffRealtimeDriver()
      default:
        throw new Error(`Unknown realtime driver: ${(config as RealtimeConfig).driver}`)
    }
  }
}
