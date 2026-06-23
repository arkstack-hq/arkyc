import type { OcrResultData } from '@arkyc/types'
import type { OcrDriver, OcrRequest } from '../types'
import { createDocumentParserRegistry, type DocumentParserRegistry } from '../parsers/registry'
import type { ParseOutput } from '../parsers/types'
import { defaultPreprocessor, type OcrPreprocessor } from './preprocess'

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))

/** MRZ (machine-readable zone) charset — uppercase letters, digits and the filler. */
const MRZ_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<'

/** Relative quality of each parse stage; higher wins when picking the best result. */
const STAGE_RANK: Record<string, number> = { mrz: 3, custom: 2, generic: 1, none: 0 }

/** Options for a single recognition pass. */
export interface RecognizeOptions {
  /**
   * Constrain recognition to the {@link MRZ_CHARSET}. This forces ambiguous OCR-B
   * glyphs into the machine-readable zone's alphabet (e.g. `O`→`0`, `I`→`1`),
   * dramatically improving the numeric MRZ lines (dates, check digits).
   */
  mrz?: boolean
}

/** Reads text from an image; returns text + an engine confidence in [0, 100]. */
export type TesseractRecognize = (
  image: Uint8Array,
  language: string,
  options?: RecognizeOptions,
) => Promise<{ text: string; confidence: number }>

/** Minimal structural type for the lazily-imported `tesseract.js` module. */
interface TesseractModule {
  createWorker(language?: string): Promise<{
    setParameters(params: Record<string, string>): Promise<unknown>
    recognize(image: Buffer): Promise<{ data: { text: string; confidence: number } }>
    terminate(): Promise<void>
  }>
}

/** A candidate OCR text to parse, with the engine confidence that produced it. */
interface Candidate {
  text: string
  engine: number
}

/** A parse result with the metadata used to rank it against other candidates. */
interface Scored {
  parsed: ParseOutput
  stage?: string
  rank: number
  score: number
  text: string
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
  /**
   * Injectable image preprocessor run on each side before recognition. Defaults
   * to a lazily-loaded `sharp` pass (grayscale/normalise/upscale) that degrades
   * to a no-op when `sharp` isn't installed. Pass `false` to disable it.
   */
  preprocess?: OcrPreprocessor | false
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
  private readonly preprocessOption?: OcrPreprocessor | false
  private preprocessImpl?: OcrPreprocessor

  constructor(options: TesseractOcrOptions = {}) {
    this.language = options.language ?? 'eng'
    this.registry = options.registry ?? createDocumentParserRegistry()
    this.recognizeImpl = options.recognize
    this.preprocessOption = options.preprocess
  }

  async extract(request: OcrRequest): Promise<OcrResultData> {
    // Read both sides — the MRZ may be on the front (passports) or the back
    // (TD1 ID cards, residence permits).
    const sides: Uint8Array[] = []
    if (request.image?.length) sides.push(request.image)
    if (request.backImage?.length) sides.push(request.backImage)

    const reads: Candidate[] = []
    for (const image of sides) {
      const read = await this.tryRecognize(image)
      if (read) reads.push({ text: read.text, engine: read.confidence })
    }

    if (reads.length === 0) {
      // Nothing readable (empty or unreadable images, or engine failure): return
      // empty so the decision engine routes on low confidence (manual review).
      return { fields: {}, confidence: 0, raw: { engine: 'tesseract', empty: true } }
    }

    // Parse each side ALONE, plus the combination. The MRZ lives on a single
    // side, and mixing both sides' text into one parse lets the other side's
    // stray long lines capture the MRZ's line slots — so a clean single side can
    // read where front+back together cannot. We keep the best-ranked result.
    const candidates: Candidate[] = [...reads]
    if (reads.length > 1) {
      candidates.push({ text: reads.map((r) => r.text).join('\n'), engine: avg(reads.map((r) => r.engine)) })
    }
    let best = this.bestOf(candidates, request)

    // Legibility fallback: if nothing parsed as an MRZ, retry each side
    // constrained to the OCR-B charset (forces O→0 / I→1 on the numeric lines),
    // which often rescues an MRZ the unconstrained pass mangled.
    if (best.rank < STAGE_RANK.mrz!) {
      const mrzReads: Candidate[] = []
      for (const image of sides) {
        const read = await this.tryRecognize(image, { mrz: true })
        if (read?.text.trim()) mrzReads.push({ text: read.text, engine: read.confidence })
      }
      if (mrzReads.length) {
        const mrzBest = this.bestOf(mrzReads, request)
        if (mrzBest.rank > best.rank || (mrzBest.rank === best.rank && mrzBest.score > best.score)) best = mrzBest
      }
    }

    return {
      fields: best.parsed.fields,
      confidence: best.score,
      raw: { engine: 'tesseract', stage: best.stage, text: best.text, parser: best.parsed.raw },
    }
  }

  /** Parse every candidate text and return the best-ranked, highest-scoring result. */
  private bestOf(candidates: Candidate[], request: OcrRequest): Scored {
    let best: Scored | null = null
    for (const candidate of candidates) {
      const scored = this.score(candidate, request)
      if (!best || scored.rank > best.rank || (scored.rank === best.rank && scored.score > best.score)) {
        best = scored
      }
    }
    return best!
  }

  /** Parse one candidate text and attach its stage rank + blended confidence. */
  private score(candidate: Candidate, request: OcrRequest): Scored {
    const parsed = this.registry.parse({
      text: candidate.text,
      country: request.country,
      documentType: request.documentType,
    })
    const stage = (parsed.raw as { stage?: string } | undefined)?.stage
    const hasFields = Object.keys(parsed.fields).length > 0
    return {
      parsed,
      stage,
      rank: STAGE_RANK[stage ?? 'none'] ?? 0,
      // A result with no extracted fields carries no confidence, whatever the engine felt.
      score: hasFields ? this.scoreConfidence(parsed.confidence, candidate.engine / 100, stage) : 0,
      text: candidate.text,
    }
  }

  /**
   * Blend the parser's structural confidence with the engine's self-reported
   * confidence — parser-dominant, because what the parser extracted matters more
   * than how sure Tesseract felt about each glyph (it is pessimistic on the OCR-B
   * MRZ font and busy document backgrounds). For the `mrz` stage the result is
   * check-digit-verified ground truth, so the engine only lifts the score and can
   * never drag a verified read down. Other stages aren't self-verifying, so the
   * engine's confidence carries more weight.
   */
  private scoreConfidence(parserConfidence: number, engine: number, stage?: string): number {
    const e = clamp01(engine)
    if (stage === 'mrz') return clamp01(parserConfidence * 0.9 + e * 0.1)
    return clamp01(parserConfidence * 0.6 + e * 0.4)
  }

  /** Recognize text, or `null` if the engine can't read the image. */
  private async tryRecognize(
    image: Uint8Array,
    options?: RecognizeOptions,
  ): Promise<{ text: string; confidence: number } | null> {
    try {
      const prepared = await this.preprocess(image)
      const recognize = this.recognizeImpl ?? (await this.loadRecognizer())
      return await recognize(prepared, this.language, options)
    } catch {
      return null
    }
  }

  /** Run the configured preprocessor (resolved once), or pass bytes through. */
  private async preprocess(image: Uint8Array): Promise<Uint8Array> {
    if (this.preprocessOption === false) return image
    if (!this.preprocessImpl) {
      this.preprocessImpl = this.preprocessOption ?? (await defaultPreprocessor())
    }
    return this.preprocessImpl(image)
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
    return async (image, language, options) => {
      const worker = await mod.createWorker(language)
      try {
        if (options?.mrz) {
          await worker.setParameters({
            tessedit_char_whitelist: MRZ_CHARSET,
            // Treat the input as a single uniform block (the MRZ band's fixed lines).
            tessedit_pageseg_mode: '6',
          })
        }
        const { data } = await worker.recognize(Buffer.from(image))
        return { text: data.text, confidence: data.confidence }
      } finally {
        await worker.terminate()
      }
    }
  }
}

/** Mean of a non-empty list of numbers. */
function avg(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length
}
