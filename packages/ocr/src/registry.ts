import type { OcrConfig, OcrDriver } from './types';
import { MockOcrDriver } from './drivers/mock';
import { ExternalOcrDriver } from './drivers/external';

/**
 * Selects an OCR driver from config. Call sites depend only on the
 * {@link OcrDriver} interface, so swapping `config.driver` changes behaviour
 * with no other changes.
 */
export class OcrDriverFactory {
  /** Resolve the OCR driver named by `config`. */
  static create(config: OcrConfig): OcrDriver {
    switch (config.driver) {
      case 'mock':
        return new MockOcrDriver();
      case 'external':
        return new ExternalOcrDriver(config);
      default:
        throw new Error(`Unknown OCR driver: ${(config as OcrConfig).driver}`);
    }
  }
}
