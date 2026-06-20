/**
 * @arkyc/ocr
 *
 * Driver-based OCR extraction. Drivers (`mock`, `tesseract`, `external`) share
 * the {@link OcrDriver} interface; {@link createOcrDriver} selects one from
 * config so call sites stay driver-agnostic.
 */
export * from './types';
export * from './registry';
export { MockOcrDriver } from './drivers/mock';
export { TesseractOcrDriver } from './drivers/tesseract';
export { ExternalOcrDriver } from './drivers/external';
