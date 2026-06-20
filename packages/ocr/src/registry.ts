import type { OcrConfig, OcrDriver } from './types';
import { MockOcrDriver } from './drivers/mock';
import { TesseractOcrDriver } from './drivers/tesseract';
import { ExternalOcrDriver } from './drivers/external';

/**
 * Resolve the OCR driver named by `config`. Call sites depend only on the
 * {@link OcrDriver} interface, so swapping `config.driver` changes behaviour
 * with no other changes.
 */
export function createOcrDriver(config: OcrConfig): OcrDriver {
  switch (config.driver) {
    case 'mock':
      return new MockOcrDriver();
    case 'tesseract':
      return new TesseractOcrDriver();
    case 'external':
      return new ExternalOcrDriver(config);
    default:
      throw new Error(`Unknown OCR driver: ${(config as OcrConfig).driver}`);
  }
}
