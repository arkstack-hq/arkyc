import type { NetworkConfig, NetworkDriver } from './types'

import { MaxMindNetworkDriver } from './drivers/maxmind'
import { MockNetworkDriver } from './drivers/mock'

/** Selects a network driver from config. */
export class NetworkDriverFactory {
  /**
   * Resolve the network driver named by `config`.
   *
   * @param config
   * @returns
   */
  static create(config: NetworkConfig): NetworkDriver {
    switch (config.driver) {
      case 'mock':
        return new MockNetworkDriver()
      case 'maxmind':
        return new MaxMindNetworkDriver(config)
      default:
        throw new Error(`Unknown network driver: ${(config as NetworkConfig).driver}`)
    }
  }
}
