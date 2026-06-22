import type { CaptureModel, DocumentType, LivenessChallenge, LivenessMode, VerificationStatus } from '@arkyc/types'

/** The session view exposed by the Client/Widget API (`GET /v1/client/session`). */
export interface ClientSession {
  id: string
  status: VerificationStatus
  expires_at: string
  /** The capture flow this session runs (Phase 17). */
  capture_model?: CaptureModel
  /** The active-liveness challenge sequence to prompt the user through. */
  liveness_challenges?: LivenessChallenge[]
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
  readonly code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'WidgetApiError'
    this.status = status
    this.code = code
  }
}

/** Options for {@link ArkycClient}. */
export interface ArkycClientOptions {
  /** Short-lived client token minted for this session. */
  token: string
  /** API origin (defaults to the same origin the widget is served from). */
  baseUrl?: string
  /** Injectable for testing; defaults to the global `fetch`. */
  fetch?: typeof fetch
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
    this.baseUrl = (options.baseUrl ?? '').replace(/\/$/, '')
    const f = options.fetch ?? globalThis.fetch
    if (!f) throw new Error('No `fetch` implementation available.')
    this.fetchImpl = f.bind(globalThis)
  }

  /**
   * Load the current session (marks it `started` on first call).
   *
   * @returns
   */
  getSession(): Promise<ClientSession> {
    return this.request('GET', '/v1/client/session')
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
    return this.request('POST', '/v1/client/document/front', form)
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
    return this.request('POST', '/v1/client/document/back', form)
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
    return this.request('POST', '/v1/client/liveness', form)
  }

  /**
   * Finalise the session (runs face-match + the decision engine).
   *
   * @param input
   * @returns
   */
  complete(input: CompleteInput = {}): Promise<ClientSession> {
    return this.request('POST', '/v1/client/complete', input.signals ?? {})
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
    const json = text ? (JSON.parse(text) as { message?: string; data?: ClientSession }) : {}

    if (!res.ok) {
      throw new WidgetApiError(json.message ?? `Request failed (${res.status})`, res.status)
    }
    return json.data as ClientSession
  }
}
