import type { ScreeningConfig, ScreeningDriver } from './types'

import { ExternalScreeningDriver } from './drivers/external'
import { MockScreeningDriver } from './drivers/mock'
import { OpenSanctionsScreeningDriver } from './drivers/opensanctions'

/** Selects a screening driver from config. */
export class ScreeningDriverFactory {
  /**
   * Resolve the screening driver named by `config`.
   *
   * @param config
   * @returns
   */
  static create(config: ScreeningConfig): ScreeningDriver {
    switch (config.driver) {
      case 'mock':
        return new MockScreeningDriver()
      case 'opensanctions':
        return new OpenSanctionsScreeningDriver(config)
      case 'external':
        return new ExternalScreeningDriver(config)
      default:
        throw new Error(`Unknown screening driver: ${(config as ScreeningConfig).driver}`)
    }
  }
}
