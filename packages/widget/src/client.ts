import type {
  ApiErrorKey,
  CaptureModel,
  DocumentType,
  LivenessChallenge,
  LivenessMode,
  ProjectBranding,
  VerificationStatus,
  WorkflowConfig,
} from '@arkyc/types'

/** The session view exposed by the Client/Widget API (`GET /v1/client/session`). */
export interface ClientSession {
  id: string
  status: VerificationStatus
  expires_at: string
  /** The capture flow this session runs (Phase 17). */
  capture_model?: CaptureModel
  /** The active-liveness challenge sequence to prompt the user through. */
  liveness_challenges?: LivenessChallenge[]
  /** Cross-device handoff config resolved from the project setting. */
  handoff?: ClientHandoff
  /** How to watch this session live (push transport params or `polling`). */
  realtime?: ClientRealtime
  /** Project branding (colours/logo/name) so the widget themes itself at runtime. */
  branding?: ProjectBranding | null
  /** The applied workflow (ordered, toggleable stages + skip_ocr), or null for the default flow. */
  workflow?: WorkflowConfig | null
}

/**
 * Realtime connection info for this session (Phase 16). `transport` selects how
 * the widget watches the session: `pusher`/`firebase` subscribe to `channel`;
 * `polling` (and `off`/`memory`) mean poll the session endpoint instead. The
 * remaining fields carry the active transport's public connection params; `token`
 * is a per-session Firebase custom token when applicable.
 */
export interface ClientRealtime {
  transport: 'pusher' | 'firebase' | 'polling' | 'off' | 'memory'
  /** The private channel this session's events publish to. */
  channel: string
  /** Per-session Firebase custom token (firebase transport only). */
  token?: string | null
  [param: string]: unknown
}

/** Whether (and where) the widget may offer cross-device handoff. */
export interface ClientHandoff {
  enabled: boolean
  /** Whether a desktop user may continue on the desktop device instead of handing off. */
  allow_desktop: boolean
  /** First-party hosted page the QR points to (the phone resumes the session there). */
  url: string
}

/**
 * Mock-driver signal hints. Real provider drivers ignore these; the `mock`
 * drivers use them to make the demo/playground flow deterministic.
 */
export interface ProviderSignalHints {
  quality_score?: number
  ocr_confidence?: number
  expired?: boolean
  liveness_score?: number
  liveness_passed?: boolean
  multiple_faces?: boolean
  face_similarity?: number
  face_match_passed?: boolean
  address_score?: number
  address_passed?: boolean
}

/** Input for the address-verification submission (opt-in stage). */
export interface AddressInput {
  /** The claimed address the user entered. */
  line1?: string | null
  line2?: string | null
  city?: string | null
  region?: string | null
  postalCode?: string | null
  /** ISO 3166-1 alpha-2 country code. */
  country?: string | null
  /** Proof-of-address document image. */
  poa?: Blob | null
  /** Captured device coordinates. */
  latitude?: number | null
  longitude?: number | null
  signals?: ProviderSignalHints
}

/** Input for the document-front submission. */
export interface DocumentFrontInput {
  image?: Blob | null
  country?: string | null
  documentType?: DocumentType | null
  signals?: ProviderSignalHints
}

/** Input for the document-back submission. */
export interface DocumentBackInput {
  image?: Blob | null
  country?: string | null
  documentType?: DocumentType | null
}

/** Input for the liveness submission (passive selfie or active challenge video). */
export interface LivenessInput {
  selfie?: Blob | null
  /** Recorded challenge video (active mode). */
  video?: Blob | null
  /** Passive (selfie) or active (challenge video). Defaults to passive. */
  mode?: LivenessMode
  /** The challenge sequence the user performed, in order (active mode). */
  challenges?: LivenessChallenge[]
  signals?: ProviderSignalHints
}

/** Input for completing the session (runs face-match + decision). */
export interface CompleteInput {
  signals?: ProviderSignalHints
}

/**
 * Raised when the Client API returns a non-2xx response.
 */
export class WidgetApiError extends Error {
  readonly status: number
  /**
   * Stable error key (e.g. `session_expired`) for errors Arkyc
   * deliberately raises. Undefined for unexpected errors.
   */
  readonly error?: ApiErrorKey

  constructor(message: string, status: number, error?: ApiErrorKey) {
    super(message)
    this.name = 'WidgetApiError'
    this.status = status
    this.error = error
  }
}

/** Options for {@link ArkycClient}. */
export interface ArkycClientOptions {
  /** Short-lived client token minted for this session. */
  token: string
  /**
   * The Client API **base** the widget appends each endpoint to — `{baseUrl}/session`,
   * `{baseUrl}/document/front`, etc. (no version prefix is added; `baseUrl` owns it).
   *
   * **Optional** — defaults to the hosted Arkyc API ({@link DEFAULT_CLIENT_BASE_URL}),
   * so the hosted product needs no config. Override only to self-host or proxy: a
   * relative path resolves against the current origin (same-origin, no CORS); an
   * absolute URL is used as-is (the API must allow your origin via CORS).
   */
  baseUrl?: string
  /** Injectable for testing; defaults to the global `fetch`. */
  fetch?: typeof fetch
}

/**
 * The default Client API base, used when no `baseUrl` is passed — so the hosted
 * product is zero-config: the browser calls it cross-origin with the client
 * token (the API allows it via CORS).
 *
 * Baked at **build time** from the `ARKYC_API_URL` env (via the tsdown `define`),
 * falling back to the hosted Arkyc API. Self-hosters set `ARKYC_API_URL` when
 * building the widget; integrators on the published package override per call
 * with `baseUrl`. Referenced through `typeof` so running the source directly
 * (tests) without the define is safe.
 */
declare const __ARKYC_API_BASE__: string | undefined
export const DEFAULT_CLIENT_BASE_URL =
  (typeof __ARKYC_API_BASE__ === 'string' ? __ARKYC_API_BASE__ : '') || 'https://api.arkyc.toneflix.net/api/v1/client'

/**
 * Resolve the request base: an explicit `baseUrl` overrides the build-time
 * {@link DEFAULT_CLIENT_BASE_URL}. The chosen value is used as-is when absolute
 * (cross-origin, CORS); a relative path resolves against the current origin
 * (same-origin proxy, no CORS).
 *
 * @param baseUrl
 * @returns
 */
export function resolveClientBaseUrl(baseUrl?: string): string {
  const raw = (baseUrl ?? '').trim().replace(/\/$/, '')
  if (!raw) return DEFAULT_CLIENT_BASE_URL
  if (/^https?:\/\//i.test(raw)) return raw
  const origin = (globalThis.location?.origin ?? '').replace(/\/$/, '')
  return `${origin}${raw.startsWith('/') ? '' : '/'}${raw}`
}

type EnvelopeNumber = number | boolean

function appendSignals(form: FormData, signals?: ProviderSignalHints): void {
  if (!signals) return
  for (const [key, value] of Object.entries(signals)) {
    if (value == null) continue
    form.append(key, String(value as EnvelopeNumber))
  }
}

/**
 * A thin, framework-agnostic client for the Arkyc Client/Widget API. Drives a
 * single verification session with a short-lived client token. All responses
 * are unwrapped from the standard `{ status, message, data }` envelope.
 */
export class ArkycClient {
  private readonly token: string
  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch

  constructor(options: ArkycClientOptions) {
    if (!options.token) throw new Error('ArkycClient requires a client `token`.')
    this.token = options.token
    this.baseUrl = resolveClientBaseUrl(options.baseUrl)
    const f = options.fetch ?? globalThis.fetch
    if (!f) throw new Error('No `fetch` implementation available.')
    this.fetchImpl = f.bind(globalThis)
  }

  /**
   * The resolved Client API base (always origin-qualified: the absolute/proxy
   * value, or the hosted default when `baseUrl` was omitted). Callers that need
   * a sibling endpoint — e.g. the realtime auth URL — must build it from this,
   * not the raw option, so a zero-config widget doesn't fall back to the page
   * origin.
   */
  get base(): string {
    return this.baseUrl
  }

  /**
   * Load the current session (marks it `started` on first call).
   *
   * @returns
   */
  getSession(): Promise<ClientSession> {
    return this.request('GET', '/session')
  }

  /**
   * Submit the document front image (triggers OCR + portrait extraction).
   *
   * @param input
   * @returns
   */
  submitDocumentFront(input: DocumentFrontInput): Promise<ClientSession> {
    const form = new FormData()
    if (input.image) form.append('image', input.image, 'document-front.jpg')
    if (input.country) form.append('country', input.country)
    if (input.documentType) form.append('document_type', input.documentType)
    appendSignals(form, input.signals)
    return this.request('POST', '/document/front', form)
  }

  /**
   * Submit the document back image.
   *
   * @param input
   * @returns
   */
  submitDocumentBack(input: DocumentBackInput): Promise<ClientSession> {
    const form = new FormData()
    if (input.image) form.append('image', input.image, 'document-back.jpg')
    if (input.country) form.append('country', input.country)
    if (input.documentType) form.append('document_type', input.documentType)
    return this.request('POST', '/document/back', form)
  }

  /**
   * Submit the selfie for the liveness check.
   *
   * @param input
   * @returns
   */
  submitLiveness(input: LivenessInput): Promise<ClientSession> {
    const form = new FormData()
    if (input.selfie) form.append('selfie', input.selfie, 'selfie.jpg')
    if (input.video) form.append('video', input.video, 'liveness.webm')
    if (input.mode) form.append('mode', input.mode)
    if (input.challenges) form.append('challenges', JSON.stringify(input.challenges))
    appendSignals(form, input.signals)
    return this.request('POST', '/liveness', form)
  }

  /**
   * Submit address verification (opt-in stage). Sends the claimed address plus
   * whichever evidence was gathered (proof-of-address image, device coordinates).
   *
   * @param input
   * @returns
   */
  submitAddress(input: AddressInput): Promise<ClientSession> {
    const form = new FormData()
    const fields: Record<string, string | null | undefined> = {
      line1: input.line1,
      line2: input.line2,
      city: input.city,
      region: input.region,
      postal_code: input.postalCode,
      country: input.country,
    }
    for (const [key, value] of Object.entries(fields)) {
      if (value) form.append(key, value)
    }
    if (input.poa) form.append('poa', input.poa, 'proof-of-address.jpg')
    if (input.latitude != null) form.append('latitude', String(input.latitude))
    if (input.longitude != null) form.append('longitude', String(input.longitude))
    appendSignals(form, input.signals)
    return this.request('POST', '/address', form)
  }

  /**
   * Finalise the session (runs face-match + the decision engine).
   *
   * @param input
   * @returns
   */
  complete(input: CompleteInput = {}): Promise<ClientSession> {
    return this.request('POST', '/complete', input.signals ?? {})
  }

  private async request(method: string, path: string, body?: FormData | object): Promise<ClientSession> {
    const headers: Record<string, string> = { 'X-Client-Token': this.token }
    let payload: BodyInit | undefined

    if (body instanceof FormData) {
      payload = body
    } else if (body) {
      headers['Content-Type'] = 'application/json'
      payload = JSON.stringify(body)
    }

    const res = await this.fetchImpl(`${this.baseUrl}${path}`, { method, headers, body: payload })
    const text = await res.text()
    const json = text ? (JSON.parse(text) as { message?: string; data?: ClientSession; error?: ApiErrorKey }) : {}

    if (!res.ok) {
      throw new WidgetApiError(json.message ?? `Request failed (${res.status})`, res.status, json.error)
    }
    return json.data as ClientSession
  }
}
