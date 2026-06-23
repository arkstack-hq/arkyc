import type { OcrResultData } from '@arkyc/types'
import type { OcrDriver, OcrRequest } from '../types'
import { createDocumentParserRegistry, type DocumentParserRegistry } from '../parsers/registry'

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))

/** Reads text from an image; returns text + an engine confidence in [0, 100]. */
export type TesseractRecognize = (image: Uint8Array, language: string) => Promise<{ text: string; confidence: number }>

/** Minimal structural type for the lazily-imported `tesseract.js` module. */
interface TesseractModule {
  createWorker(language?: string): Promise<{
    recognize(image: Buffer): Promise<{ data: { text: string; confidence: number } }>
    terminate(): Promise<void>
  }>
}

export interface TesseractOcrOptions {
  /** Recognition language(s), default `eng`. */
  language?: string
  /**
   * Parser registry used to turn recognized text into fields. Defaults to the
   * MRZ-backed registry; pass one with your country/type parsers registered.
   */
  registry?: DocumentParserRegistry
  /** Injectable recognizer (tests); defaults to a lazily-loaded `tesseract.js`. */
  recognize?: TesseractRecognize
}

/**
 * In-process OCR via Tesseract.js. Recognizes text from the document image, then
 * runs it through the {@link DocumentParserRegistry} to extract structured fields.
 * `tesseract.js` is imported lazily so it is only loaded when this driver runs.
 */
export class TesseractOcrDriver implements OcrDriver {
  readonly name = 'tesseract'
  private readonly language: string
  private readonly registry: DocumentParserRegistry
  private readonly recognizeImpl?: TesseractRecognize

  constructor(options: TesseractOcrOptions = {}) {
    this.language = options.language ?? 'eng'
    this.registry = options.registry ?? createDocumentParserRegistry()
    this.recognizeImpl = options.recognize
  }

  async extract(request: OcrRequest): Promise<OcrResultData> {
    // Read both sides — the MRZ may be on the front (passports) or the back
    // (TD1 ID cards, residence permits). Parse the combined text once.
    const front = request.image?.length ? await this.tryRecognize(request.image) : null
    const back = request.backImage?.length ? await this.tryRecognize(request.backImage) : null

    if (!front && !back) {
      // Nothing readable (empty or unreadable images, or engine failure): return
      // empty so the decision engine routes on low confidence (manual review).
      return { fields: {}, confidence: 0, raw: { engine: 'tesseract', empty: true } }
    }

    const text = [front?.text ?? '', back?.text ?? ''].filter((t) => t.trim()).join('\n')
    const confidences = [front?.confidence, back?.confidence].filter((c): c is number => typeof c === 'number')
    const engineConfidence = confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0

    const parsed = this.registry.parse({
      text,
      country: request.country,
      documentType: request.documentType,
    })
    return {
      fields: parsed.fields,
      // Blend the engine's raw confidence with the parser's structural confidence.
      confidence: clamp01((engineConfidence / 100) * 0.5 + parsed.confidence * 0.5),
      raw: { engine: 'tesseract', text, parser: parsed.raw },
    }
  }

  /** Recognize text, or `null` if the engine can't read the image. */
  private async tryRecognize(image: Uint8Array): Promise<{ text: string; confidence: number } | null> {
    try {
      const recognize = this.recognizeImpl ?? (await this.loadRecognizer())
      return await recognize(image, this.language)
    } catch {
      return null
    }
  }

  /** Lazily load `tesseract.js` and adapt it to {@link TesseractRecognize}. */
  private async loadRecognizer(): Promise<TesseractRecognize> {
    const moduleName = 'tesseract.js'
    let mod: TesseractModule
    try {
      mod = (await import(/* @vite-ignore */ moduleName)) as unknown as TesseractModule
    } catch {
      throw new Error(
        "OCR driver 'tesseract' requires the 'tesseract.js' package. Install it with: pnpm add tesseract.js -F @arkyc/ocr",
      )
    }
    return async (image, language) => {
      const worker = await mod.createWorker(language)
      try {
        const { data } = await worker.recognize(Buffer.from(image))
        return { text: data.text, confidence: data.confidence }
      } finally {
        await worker.terminate()
      }
    }
  }
}
