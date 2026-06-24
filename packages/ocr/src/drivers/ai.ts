import type { DocumentType, OcrAuthenticity, OcrFields, OcrResultData } from '@arkyc/types'
import type { OcrDriver, OcrRequest } from '../types'

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))

/**
 * Anthropic's default API base; override for a gateway/proxy.
 */
const DEFAULT_BASE_URL = 'https://api.anthropic.com'

/**
 * A small, cheap vision model is plenty for reading printed/MRZ document text.
 */
export const DEFAULT_AI_MODEL = 'claude-haiku-4-5-20251001'

/**
 * Longest edge (px) we upload. The API downsamples anything larger anyway and
 * bills by the resampled size, so this is a cost/bandwidth bound, not a quality
 * one — small enough to be cheap, large enough to keep the MRZ legible.
 */
const DEFAULT_MAX_EDGE = 1568

/**
 * Per-attempt request timeout (ms) — a hung connection must not stall a worker.
 */
const DEFAULT_TIMEOUT_MS = 30_000

/**
 * Bounded in-driver retries on rate-limit/overload; the job queue retries beyond.
 */
const DEFAULT_MAX_RETRIES = 2

/**
 * A base64 image ready for the messages API, with its detected media type.
 */
interface PreparedImage {
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp'
  data: string
}

/**
 * Raw fields the vision model returned, before validation/scoring.
 */
export interface AiExtraction {
  fields: OcrFields
  /** The model's own legibility self-assessment in [0, 1], if it gave one. */
  legibility?: number
  documentType?: DocumentType | null
  /** Best-effort tamper/replay read; omitted when the model reported nothing. */
  authenticity?: OcrAuthenticity
}

/**
 * Calls a vision model and returns the raw extracted fields. Injected so the
 * driver's scoring can be unit-tested without a network call; the default
 * implementation talks to the Anthropic messages API.
 */
export type AiVisionExtract = (request: OcrRequest, images: PreparedImage[]) => Promise<AiExtraction>

export interface AnthropicOcrOptions {
  apiKey?: string
  /** Model id; defaults to {@link DEFAULT_AI_MODEL}. */
  model?: string
  /** API base URL; defaults to {@link DEFAULT_BASE_URL}. */
  baseUrl?: string
  /** Longest image edge (px) to upload; defaults to {@link DEFAULT_MAX_EDGE}. */
  maxEdge?: number
  /** Per-attempt request timeout (ms); defaults to {@link DEFAULT_TIMEOUT_MS}. */
  timeoutMs?: number
  /** Bounded retries on 429/529; defaults to {@link DEFAULT_MAX_RETRIES}. */
  maxRetries?: number
  /** Override the vision call (tests). When set, `apiKey` is not required. */
  extract?: AiVisionExtract
}

/**
 * AI OCR driver: hands the document image(s) to a vision LLM (Claude by default)
 * and maps the structured response onto {@link OcrResultData}.
 *
 * Confidence is **not** taken from the model's self-report — LLMs are poorly
 * calibrated and will state high confidence on hallucinated fields. Instead it's
 * derived deterministically from which fields came back and whether they're
 * structurally valid (see {@link scoreConfidence}), so the value feeding the
 * decision engine's `ocrConfidenceThreshold` is meaningful. The model's own
 * legibility read is folded in only as a small soft penalty.
 *
 * It also asks the model for a best-effort, image-only authenticity read
 * (screen-replay, photocopy, digital/physical tampering). That signal is
 * advisory: a fired flag only *caps* the OCR confidence (see
 * {@link applyAuthenticity}) so a suspicious document routes to manual review —
 * an LLM's authenticity guess never auto-rejects a user on its own.
 */
export class AnthropicOcrDriver implements OcrDriver {
  readonly name = 'ai'

  private readonly model: string
  private readonly baseUrl: string
  private readonly maxEdge: number
  private readonly vision: AiVisionExtract

  constructor(options: AnthropicOcrOptions = {}) {
    if (!options.apiKey && !options.extract) {
      throw new Error('AnthropicOcrDriver requires config.apiKey')
    }
    this.model = options.model ?? DEFAULT_AI_MODEL
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '')
    this.maxEdge = options.maxEdge ?? DEFAULT_MAX_EDGE
    this.vision =
      options.extract ??
      anthropicVision({
        apiKey: options.apiKey as string,
        model: this.model,
        baseUrl: this.baseUrl,
        timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
      })
  }

  async extract(request: OcrRequest): Promise<OcrResultData> {
    const images = await this.prepareImages(request)
    const raw = await this.vision(request, images)
    const fields = normalizeFields(raw.fields)
    const authenticity = raw.authenticity
    const confidence = applyAuthenticity(scoreConfidence(fields, raw.legibility), authenticity)

    return {
      fields,
      confidence,
      ...(authenticity ? { authenticity } : {}),
      raw: {
        provider: 'ai',
        model: this.model,
        legibility: raw.legibility ?? null,
        documentType: raw.documentType ?? request.documentType ?? null,
        authenticity: authenticity ?? null,
      },
    }
  }

  /**
   * Resize (best-effort) and base64-encode the front + optional back images.
   *
   * @param input
   * @returns
   */
  private async prepareImages(request: OcrRequest): Promise<PreparedImage[]> {
    const sources = [request.image, request.backImage].filter((b): b is Uint8Array => !!b && b.length > 0)
    return Promise.all(sources.map((bytes) => prepareImage(bytes, this.maxEdge)))
  }
}

const present = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const isIsoDate = (v: unknown): boolean => present(v) && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))

/**
 * Trim/blank-out the model's fields; drop anything empty so callers see `undefined`.
 *
 * @param input
 * @returns
 */
function normalizeFields(fields: OcrFields): OcrFields {
  const out: OcrFields = {}
  const set = (key: keyof OcrFields, value: string | undefined) => {
    if (present(value)) out[key] = value.trim()
  }
  set('firstName', fields.firstName)
  set('lastName', fields.lastName)
  set('fullName', fields.fullName)
  set('dateOfBirth', fields.dateOfBirth)
  set('documentNumber', fields.documentNumber)
  set('expiryDate', fields.expiryDate)
  set('nationality', fields.nationality)
  return out
}

/**
 * Deterministic confidence in [0, 1] from field completeness + structural
 * validity. Weights sum to 1.0 when every field is present and well-formed; the
 * model's self-reported legibility can only pull the score down by up to 15%, so
 * trustworthy structure dominates an unreliable self-assessment.
 *
 * @param fields
 * @param legibility
 * @returns
 */
export function scoreConfidence(fields: OcrFields, legibility?: number): number {
  const hasName = (present(fields.firstName) && present(fields.lastName)) || present(fields.fullName)
  const checks: Array<[boolean, number]> = [
    [hasName, 0.28],
    [isIsoDate(fields.dateOfBirth), 0.22],
    [present(fields.documentNumber) && fields.documentNumber!.trim().length >= 4, 0.22],
    [isIsoDate(fields.expiryDate), 0.16],
    [present(fields.nationality), 0.12],
  ]
  const base = checks.reduce((sum, [ok, weight]) => (ok ? sum + weight : sum), 0)
  const legible = clamp01(legibility ?? 1)
  return clamp01(base * (0.85 + 0.15 * legible))
}

/**
 * Hard ceiling on OCR confidence once any authenticity flag fires. Below the
 * default `ocrConfidenceThreshold` (0.8), so a flagged document routes to manual
 * review regardless of how cleanly its fields read.
 */
const SUSPECT_CONFIDENCE_CEILING = 0.5

/**
 * Fold the authenticity read into the field-derived confidence. Only ever lowers
 * the score, and only when a concrete flag fired — a genuine (or unassessed)
 * document is returned untouched. A flagged document is capped at both the
 * model's own authenticity confidence and {@link SUSPECT_CONFIDENCE_CEILING},
 * which lands it in manual review rather than auto-approval. This is deliberately
 * conservative: the LLM's authenticity guess can demote, never reject outright.
 *
 * @param fieldScore
 * @param authenticity
 * @returns
 */
export function applyAuthenticity(fieldScore: number, authenticity?: OcrAuthenticity): number {
  if (!authenticity || authenticity.genuine) return fieldScore
  return Math.min(fieldScore, clamp01(authenticity.confidence), SUSPECT_CONFIDENCE_CEILING)
}

const SYSTEM_PROMPT =
  'You are an OCR engine for identity documents. Read the visible printed text and ' +
  'the machine-readable zone (MRZ) if present, and return the fields exactly as ' +
  'printed. Do not guess, infer, or correct values you cannot clearly read — omit a ' +
  'field rather than fabricate it. Dates must be ISO 8601 (YYYY-MM-DD).\n\n' +
  'Identity documents print BOTH a date of issue and a date of expiry — never ' +
  'confuse them. `expiryDate` is only the expiry/expiration/"valid until"/"date of ' +
  'expiry" value (in an MRZ, the second date field, not the first). `issueDate` is ' +
  'the "date of issue"/"issued"/"valid from" value. The expiry is later than the ' +
  'issue date. If a document shows only an issue date and no expiry, return the ' +
  'issue date in `issueDate` and leave `expiryDate` empty — do not put the issue ' +
  'date in `expiryDate`.\n\n' +
  'ALSO assess document authenticity, to the best of your ability, from the image ' +
  'alone — and report it. Be conservative: raise a flag only on a clear, visible ' +
  'sign. A genuine document that was merely photographed imperfectly (blur, glare ' +
  'on a glossy original, a shadow, a crop) must NOT be flagged. Set `screenReplay` ' +
  'when the image looks like a photo of a screen — moiré or a visible pixel grid, ' +
  'backlit glow, refresh banding, or a device bezel (a replay attack). Set ' +
  '`photocopy` when it looks like a photo or scan of a printout/photocopy rather ' +
  'than the physical document — flat matte paper, halftone dot printing, no ' +
  'security features or hologram. Set `digitalTampering` for signs of digital ' +
  'editing — mismatched fonts or kerning, misaligned or recoloured text, smudged ' +
  'or cloned regions, a pasted-in portrait, or altered dates. Set ' +
  '`physicalTampering` for a substituted photo, peeled or lifted laminate, or ' +
  'scratched-out / overwritten fields. Give `authenticityConfidence` from 0 ' +
  '(clearly fake or replayed) to 1 (clearly an authentic original), and list brief ' +
  'supporting notes in `authenticityObservations`. You read and assess the ' +
  'document; you do not make the final accept/reject decision.'

const READ_TOOL = {
  name: 'read_document',
  description: 'Return the identity fields read from the document image(s).',
  input_schema: {
    type: 'object',
    properties: {
      firstName: { type: 'string', description: 'Given name(s) as printed.' },
      lastName: { type: 'string', description: 'Surname / family name as printed.' },
      fullName: { type: 'string', description: 'Full name if given/surname cannot be separated.' },
      dateOfBirth: { type: 'string', description: 'Date of birth, ISO 8601 YYYY-MM-DD.' },
      documentNumber: { type: 'string', description: 'Document/serial number as printed.' },
      issueDate: {
        type: 'string',
        description: 'Date of issue ("issued"/"valid from"/"issue date"), ISO 8601 YYYY-MM-DD. NOT the expiry.',
      },
      expiryDate: {
        type: 'string',
        description:
          'Expiry date ("date of expiry"/"valid until"/"expiry date"), ISO 8601 YYYY-MM-DD. Must be the expiry, never the issue date; omit if the document shows no expiry.',
      },
      nationality: { type: 'string', description: 'ISO 3166-1 alpha-3 country code if determinable.' },
      documentType: {
        type: 'string',
        enum: ['passport', 'id_card', 'drivers_license', 'residence_permit'],
      },
      legibility: {
        type: 'number',
        description: 'How clearly the document text could be read, 0 (illegible) to 1 (crisp).',
      },
      screenReplay: {
        type: 'boolean',
        description: 'Looks like a photo of a screen (moiré, pixel grid, backlit glow, refresh banding, bezel).',
      },
      photocopy: {
        type: 'boolean',
        description: 'Looks like a photo/scan of a printout or photocopy rather than the physical document.',
      },
      digitalTampering: {
        type: 'boolean',
        description:
          'Signs of digital editing: mismatched fonts, misaligned/recoloured text, cloned regions, edited photo/dates.',
      },
      physicalTampering: {
        type: 'boolean',
        description:
          'Signs of physical tampering: substituted photo, peeled laminate, scratched-out/overwritten fields.',
      },
      authenticityConfidence: {
        type: 'number',
        description: 'Authenticity confidence, 0 (clearly fake/replayed) to 1 (clearly an authentic original).',
      },
      authenticityObservations: {
        type: 'array',
        items: { type: 'string' },
        description: 'Brief notes supporting any authenticity flag raised.',
      },
    },
  },
} as const

/**
 * Minimal shape of the messages-API response we read.
 *
 */
interface AnthropicResponse {
  content?: Array<{ type: string; name?: string; input?: Record<string, unknown> }>
}

const DOCUMENT_TYPES: readonly DocumentType[] = ['passport', 'id_card', 'drivers_license', 'residence_permit']

/**
 * HTTP statuses worth a bounded retry: rate-limited / overloaded.
 */
const RETRYABLE_STATUS = new Set([429, 529])

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Exponential backoff (ms) for attempt 0, 1, 2…, capped at 8s.
 */
const backoffMs = (attempt: number): number => Math.min(8_000, 500 * 2 ** attempt)

/**
 * Parse a `retry-after` header (seconds) into ms; null when absent/invalid.
 */
function retryAfterMs(res: Response): number | null {
  const header = res.headers.get('retry-after')
  if (!header) return null
  const seconds = Number(header)
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : null
}

/**
 * POST with a per-attempt timeout and a bounded retry on 429/529 — honouring
 * `retry-after`, else exponential backoff. Timeouts/network errors retry too;
 * any other response is returned as-is for the caller to handle. The durable job
 * queue is the longer-term retry beyond {@link DEFAULT_MAX_RETRIES}.
 *
 * @param url
 * @param init
 * @param timeoutMs
 * @param maxRetries
 * @returns
 */
async function postWithRetry(url: string, init: RequestInit, timeoutMs: number, maxRetries: number): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    let res: Response
    try {
      res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
    } catch (error) {
      if (attempt >= maxRetries) throw error
      await sleep(backoffMs(attempt))
      continue
    }
    if (RETRYABLE_STATUS.has(res.status) && attempt < maxRetries) {
      await sleep(retryAfterMs(res) ?? backoffMs(attempt))
      continue
    }
    return res
  }
}

/**
 * Build the default vision call against the Anthropic messages API.
 *
 * @param input
 * @returns
 */
export function anthropicVision(opts: {
  apiKey: string
  model: string
  baseUrl: string
  timeoutMs?: number
  maxRetries?: number
}): AiVisionExtract {
  return async (request, images) => {
    const hint = request.documentType ? ` The document is a ${request.documentType}.` : ''
    const country = request.country ? ` Issuing country hint: ${request.country}.` : ''
    const res = await postWithRetry(
      `${opts.baseUrl}/v1/messages`,
      {
        method: 'POST',
        headers: {
          'x-api-key': opts.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: opts.model,
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          tools: [READ_TOOL],
          tool_choice: { type: 'tool', name: 'read_document' },
          messages: [
            {
              role: 'user',
              content: [
                ...images.map((img) => ({
                  type: 'image',
                  source: { type: 'base64', media_type: img.mediaType, data: img.data },
                })),
                { type: 'text', text: `Read this identity document and return its fields.${hint}${country}` },
              ],
            },
          ],
        }),
      },
      opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      opts.maxRetries ?? DEFAULT_MAX_RETRIES,
    )

    if (!res.ok) {
      throw new Error(`AnthropicOcrDriver request failed with status ${res.status}`)
    }

    const json = (await res.json()) as AnthropicResponse
    const tool = json.content?.find((block) => block.type === 'tool_use' && block.name === 'read_document')
    if (!tool?.input) {
      throw new Error('AnthropicOcrDriver: model returned no structured fields')
    }

    return mapToolInput(tool.input)
  }
}

/**
 * Coerce the model's tool input into an {@link AiExtraction} (string-typed fields).
 *
 * @param input
 * @returns
 */
function mapToolInput(input: Record<string, unknown>): AiExtraction {
  const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
  const docType = str(input.documentType)
  return {
    fields: {
      firstName: str(input.firstName),
      lastName: str(input.lastName),
      fullName: str(input.fullName),
      dateOfBirth: str(input.dateOfBirth),
      documentNumber: str(input.documentNumber),
      expiryDate: str(input.expiryDate),
      nationality: str(input.nationality),
    },
    legibility: typeof input.legibility === 'number' ? input.legibility : undefined,
    documentType: docType && (DOCUMENT_TYPES as readonly string[]).includes(docType) ? (docType as DocumentType) : null,
    authenticity: mapAuthenticity(input),
  }
}

/**
 * Build the {@link OcrAuthenticity} read from the model's tool input. Returns
 * `undefined` when the model reported nothing assessable (no flags, no
 * confidence, no notes) so a driver that can't see authenticity stays silent.
 *
 * @param input
 * @returns
 */
function mapAuthenticity(input: Record<string, unknown>): OcrAuthenticity | undefined {
  const bool = (v: unknown): boolean => v === true
  const screenReplay = bool(input.screenReplay)
  const photocopy = bool(input.photocopy)
  const digitalTampering = bool(input.digitalTampering)
  const physicalTampering = bool(input.physicalTampering)
  const flagged = screenReplay || photocopy || digitalTampering || physicalTampering

  const observations = Array.isArray(input.authenticityObservations)
    ? input.authenticityObservations
        .filter((o): o is string => typeof o === 'string' && o.trim().length > 0)
        .map((o) => o.trim())
        .slice(0, 6)
    : []

  const reported = typeof input.authenticityConfidence === 'number'
  // The model said nothing about authenticity at all — don't fabricate a verdict.
  if (!flagged && !reported && observations.length === 0) return undefined

  // A flagged document with no explicit score defaults to clearly-suspect (0.2);
  // an unflagged read defaults to clearly-genuine (1).
  const confidence = clamp01(reported ? (input.authenticityConfidence as number) : flagged ? 0.2 : 1)

  return { genuine: !flagged, confidence, screenReplay, photocopy, digitalTampering, physicalTampering, observations }
}

/**
 * Detect the media type from magic bytes; default to JPEG.
 *
 * @param bytes
 * @returns
 */
function detectMediaType(bytes: Uint8Array): PreparedImage['mediaType'] {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg'
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png'
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57) return 'image/webp'
  return 'image/jpeg'
}

interface SharpInstance {
  metadata(): Promise<{ width?: number; height?: number }>
  resize(options: { width?: number; height?: number; fit: string; withoutEnlargement: boolean }): SharpInstance
  jpeg(options: { quality: number }): SharpInstance
  toBuffer(): Promise<Buffer>
}
type SharpFactory = (input: Buffer) => SharpInstance

let sharpFactory: SharpFactory | null | undefined

/** Lazily resolve the optional `sharp` factory once; null when not installed. */
async function loadSharp(): Promise<SharpFactory | null> {
  if (sharpFactory !== undefined) return sharpFactory
  const moduleName = 'sharp'
  try {
    const mod = (await import(/* @vite-ignore */ moduleName)) as unknown as { default: SharpFactory }
    sharpFactory = mod.default
  } catch {
    sharpFactory = null
  }
  return sharpFactory
}

/**
 * Downscale an image to `maxEdge` and re-encode as JPEG to bound the upload (and
 * therefore the model's image-token cost). Falls back to the original bytes when
 * `sharp` isn't installed or fails — the API caps oversized images itself.
 *
 * @param url
 * @param init
 * @param timeoutMs
 * @param maxRetries
 * @returns
 */
async function prepareImage(bytes: Uint8Array, maxEdge: number): Promise<PreparedImage> {
  const sharp = await loadSharp()
  if (sharp) {
    try {
      const input = Buffer.from(bytes)
      const { width, height } = await sharp(input).metadata()
      const longest = Math.max(width ?? 0, height ?? 0)
      let pipe = sharp(input)
      if (longest > maxEdge) {
        pipe = pipe.resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true })
      }
      const out = await pipe.jpeg({ quality: 85 }).toBuffer()
      return { mediaType: 'image/jpeg', data: out.toString('base64') }
    } catch {
      // fall through to raw bytes
    }
  }
  return { mediaType: detectMediaType(bytes), data: Buffer.from(bytes).toString('base64') }
}
