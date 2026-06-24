/**
 * @arkyc/ocr
 *
 * Driver-based OCR extraction. Drivers (`mock`, `tesseract`, `external`, `ai`) share
 * the {@link OcrDriver} interface; {@link OcrDriverFactory} selects one from config so
 * call sites stay driver-agnostic. The `tesseract` driver reads text in-process
 * (Tesseract.js, lazily loaded) and runs it through the document-parser registry;
 * `ai` hands the image to a vision LLM (Claude); point `external` at any OCR HTTP
 * service instead.
 */
export * from './types'
export * from './registry'
export { MockOcrDriver } from './drivers/mock'
export { ExternalOcrDriver } from './drivers/external'
export { TesseractOcrDriver } from './drivers/tesseract'
export {
  AnthropicOcrDriver,
  anthropicVision,
  scoreConfidence,
  DEFAULT_AI_MODEL,
  type AnthropicOcrOptions,
  type AiVisionExtract,
  type AiExtraction,
} from './drivers/ai'
export type { TesseractOcrOptions, TesseractRecognize, RecognizeOptions } from './drivers/tesseract'
export {
  buildSharpPreprocessor,
  defaultPreprocessor,
  passthrough,
  type OcrPreprocessor,
  type PreprocessOptions,
} from './drivers/preprocess'

// Document-parser registry: turn OCR text into structured fields, with
// country/document-type matching and an MRZ default.
export type { DocumentParser, ParseInput, ParseOutput } from './parsers/types'
export { DocumentParserRegistry, createDocumentParserRegistry, type ParseStage } from './parsers/registry'
export { mrzParser } from './parsers/mrz'
export { genericTextParser } from './parsers/generic'
