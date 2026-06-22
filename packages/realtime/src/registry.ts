import type { RealtimeConfig, RealtimeDriver } from './types'
import { OffRealtimeDriver } from './drivers/off'
import { MemoryRealtimeDriver } from './drivers/memory'
import { SoketiRealtimeDriver } from './drivers/soketi'
import { FirebaseRealtimeDriver } from './drivers/firebase'

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
      case 'soketi':
        return config.soketi ? new SoketiRealtimeDriver(config.soketi) : new OffRealtimeDriver()
      case 'firebase':
        return config.firebase ? new FirebaseRealtimeDriver(config.firebase) : new OffRealtimeDriver()
      case 'memory':
        return new MemoryRealtimeDriver()
      case 'off':
        return new OffRealtimeDriver()
      default:
        throw new Error(`Unknown realtime driver: ${(config as RealtimeConfig).driver}`)
    }
  }
}
