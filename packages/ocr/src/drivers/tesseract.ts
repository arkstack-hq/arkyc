import type { OcrResultData } from '@arkyc/types';
import type { OcrDriver, OcrRequest } from '../types';

/**
 * Tesseract-backed OCR driver.
 *
 * Placeholder: wiring the native/WASM Tesseract engine + field parsing lands
 * with the deployment work. It is registered so `OCR_DRIVER=tesseract` resolves,
 * but throws until implemented rather than silently degrading.
 */
export class TesseractOcrDriver implements OcrDriver {
  readonly name = 'tesseract';

  async extract(_request: OcrRequest): Promise<OcrResultData> {
    throw new Error('TesseractOcrDriver is not yet implemented');
  }
}
