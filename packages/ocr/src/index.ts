/**
 * @arkyc/ocr
 *
 * Driver-based OCR extraction. Drivers (`mock`, `external`) share the
 * {@link OcrDriver} interface; {@link createOcrDriver} selects one from config so
 * call sites stay driver-agnostic. Point `external` at any OCR HTTP service
 * (e.g. a self-hosted Tesseract/model server).
 */
export * from './types'
export * from './registry'
export { MockOcrDriver } from './drivers/mock'
export { ExternalOcrDriver } from './drivers/external'
