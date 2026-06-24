import type { DocumentType, OcrFields, OcrResultData } from '@arkyc/types'
import type { OcrDriver, OcrRequest } from '../types'

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))

/** Anthropic's default API base; override for a gateway/proxy. */
const DEFAULT_BASE_URL = 'https://api.anthropic.com'
/** A small, cheap vision model is plenty for reading printed/MRZ document text. */
export const DEFAULT_AI_MODEL = 'claude-haiku-4-5-20251001'
/**
 * Longest edge (px) we upload. The API downsamples anything larger anyway and
 * bills by the resampled size, so this is a cost/bandwidth bound, not a quality
 * one — small enough to be cheap, large enough to keep the MRZ legible.
 */
const DEFAULT_MAX_EDGE = 1568

/** A base64 image ready for the messages API, with its detected media type. */
interface PreparedImage {
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp'
  data: string
}

/** Raw fields the vision model returned, before validation/scoring. */
export interface AiExtraction {
  fields: OcrFields
  /** The model's own legibility self-assessment in [0, 1], if it gave one. */
  legibility?: number
  documentType?: DocumentType | null
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
 * This reads the document; it does not assess authenticity/tampering.
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
      options.extract ?? anthropicVision({ apiKey: options.apiKey as string, model: this.model, baseUrl: this.baseUrl })
  }

  async extract(request: OcrRequest): Promise<OcrResultData> {
    const images = await this.prepareImages(request)
    const raw = await this.vision(request, images)
    const fields = normalizeFields(raw.fields)
    const confidence = scoreConfidence(fields, raw.legibility)

    return {
      fields,
      confidence,
      raw: {
        provider: 'ai',
        model: this.model,
        legibility: raw.legibility ?? null,
        documentType: raw.documentType ?? request.documentType ?? null,
      },
    }
  }

  /** Resize (best-effort) and base64-encode the front + optional back images. */
  private async prepareImages(request: OcrRequest): Promise<PreparedImage[]> {
    const sources = [request.image, request.backImage].filter((b): b is Uint8Array => !!b && b.length > 0)
    return Promise.all(sources.map((bytes) => prepareImage(bytes, this.maxEdge)))
  }
}

// --- field validation + confidence scoring -------------------------------------

const present = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const isIsoDate = (v: unknown): boolean => present(v) && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))

/** Trim/blank-out the model's fields; drop anything empty so callers see `undefined`. */
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

// --- Anthropic messages API ----------------------------------------------------

const SYSTEM_PROMPT =
  'You are an OCR engine for identity documents. Read the visible printed text and ' +
  'the machine-readable zone (MRZ) if present, and return the fields exactly as ' +
  'printed. Do not guess, infer, or correct values you cannot clearly read — omit a ' +
  'field rather than fabricate it. Dates must be ISO 8601 (YYYY-MM-DD).'

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
      expiryDate: { type: 'string', description: 'Expiry date, ISO 8601 YYYY-MM-DD.' },
      nationality: { type: 'string', description: 'ISO 3166-1 alpha-3 country code if determinable.' },
      documentType: {
        type: 'string',
        enum: ['passport', 'id_card', 'drivers_license', 'residence_permit'],
      },
      legibility: {
        type: 'number',
        description: 'How clearly the document text could be read, 0 (illegible) to 1 (crisp).',
      },
    },
  },
} as const

/** Minimal shape of the messages-API response we read. */
interface AnthropicResponse {
  content?: Array<{ type: string; name?: string; input?: Record<string, unknown> }>
}

const DOCUMENT_TYPES: readonly DocumentType[] = ['passport', 'id_card', 'drivers_license', 'residence_permit']

/** Build the default vision call against the Anthropic messages API. */
export function anthropicVision(opts: { apiKey: string; model: string; baseUrl: string }): AiVisionExtract {
  return async (request, images) => {
    const hint = request.documentType ? ` The document is a ${request.documentType}.` : ''
    const country = request.country ? ` Issuing country hint: ${request.country}.` : ''
    const res = await fetch(`${opts.baseUrl}/v1/messages`, {
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
    })

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

/** Coerce the model's tool input into an {@link AiExtraction} (string-typed fields). */
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
  }
}

// --- image preparation ---------------------------------------------------------

/** Detect the media type from magic bytes; default to JPEG. */
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
