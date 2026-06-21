import type { FaceMatchConfig, FaceMatchDriver } from './types'

import { ExternalFaceMatchDriver } from './drivers/external'
import { MockFaceMatchDriver } from './drivers/mock'

/** Selects a face-match driver from config. */
export class FaceMatchDriverFactory {
  /**'
   * Resolve the face-match driver named by `config`.
   *
   * @param config
   * @returns
   */
  static create(config: FaceMatchConfig): FaceMatchDriver {
    switch (config.driver) {
      case 'mock':
        return new MockFaceMatchDriver()
      case 'external':
        return new ExternalFaceMatchDriver(config)
      default:
        throw new Error(`Unknown face-match driver: ${(config as FaceMatchConfig).driver}`)
    }
  }
}
