import type { LivenessConfig, LivenessDriver } from './types'

import { ExternalLivenessDriver } from './drivers/external'
import { MockLivenessDriver } from './drivers/mock'

/**
 * Selects a liveness driver from config.
 */
export class LivenessDriverFactory {
  /**
   * Resolve the liveness driver named by `config`.
   *
   * @param config
   * @returns
   */
  static create(config: LivenessConfig): LivenessDriver {
    switch (config.driver) {
      case 'mock':
        return new MockLivenessDriver()
      case 'external':
        return new ExternalLivenessDriver(config)
      default:
        throw new Error(`Unknown liveness driver: ${(config as LivenessConfig).driver}`)
    }
  }
}
