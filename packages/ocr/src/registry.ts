import type { OcrConfig, OcrDriver } from './types'

import { ExternalOcrDriver } from './drivers/external'
import { MockOcrDriver } from './drivers/mock'
import { TesseractOcrDriver } from './drivers/tesseract'

/**
 * Selects an OCR driver from config. Call sites depend only on the
 * {@link OcrDriver} interface, so swapping `config.driver` changes behaviour
 * with no other changes.
 */
export class OcrDriverFactory {
  /**
   * Resolve the OCR driver named by `config`.
   *
   * @param config
   * @returns
   */
  static create(config: OcrConfig): OcrDriver {
    switch (config.driver) {
      case 'mock':
        return new MockOcrDriver()
      case 'tesseract':
        return new TesseractOcrDriver({ language: config.language })
      case 'external':
        return new ExternalOcrDriver(config)
      default:
        throw new Error(`Unknown OCR driver: ${(config as OcrConfig).driver}`)
    }
  }
}
