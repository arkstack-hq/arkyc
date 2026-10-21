import type {
  DecisionReason,
  ExtractedData,
  Metadata,
  VerificationDecision,
  VerificationStatus,
  WebhookEndpointStatus,
  WebhookEventName,
  WorkflowConfig,
} from '@arkyc/types'

/** A verification session as returned by the public API (snake_case JSON). */
export interface VerificationSession {
  id: string
  project_id: string
  user_reference: string | null
  status: VerificationStatus
  auto_decision: VerificationDecision | null
  final_decision: VerificationDecision | null
  decision_reason: DecisionReason | null
  risk_score: number | null
  assigned_to: string | null
  /** The workflow applied to this session, if any (its ID), and the frozen config. */
  workflow_id: string | null
  workflow: WorkflowConfig | null
  /** Signed, time-limited URLs for captured assets, served inline as images (present on retrieve). */
  assets?: Record<string, string> | null
  /**
   * Extracted PII (identity/address). Present on `retrieve()` only when the
   * project holds a granted `pii` entitlement, and `null` otherwise.
   */
  extracted?: ExtractedData | null
  expires_at: string
  completed_at: string | null
  created_at: string
}

/** Parameters for opening a verification session. */
export interface CreateSessionParams {
  /** Your reference for the user being verified. */
  userReference?: string | null
  /** Arbitrary metadata stored with the session. */
  metadata?: Metadata | null
  /** Workflow to apply, overriding the client's default `workflowId` for this session. */
  workflowId?: string | null
}

/** A freshly opened session plus its one-time client token for the widget. */
export interface CreatedSession {
  session: VerificationSession
  clientToken: string
}

/** A webhook endpoint as returned by the public API (the signing secret is never included). */
export interface WebhookEndpoint {
  id: string
  project_id: string
  url: string
  events: WebhookEventName[]
  status: WebhookEndpointStatus
  created_at: string
}

/** Parameters for registering a webhook endpoint. */
export interface CreateWebhookEndpointParams {
  /** The URL deliveries are POSTed to. */
  url: string
  /** The events to deliver. */
  events: WebhookEventName[]
}

/** Parameters for updating a webhook endpoint: only the fields supplied change. */
export interface UpdateWebhookEndpointParams {
  url?: string
  events?: WebhookEventName[]
  status?: WebhookEndpointStatus
}

/** A freshly registered endpoint plus its signing secret, returned only this once. */
export interface CreatedWebhookEndpoint {
  endpoint: WebhookEndpoint
  /** The `whsec_…` signing secret. Store it now: it is never returned again. */
  secret: string
}

/** Pagination for listing webhook endpoints. */
export interface ListWebhookEndpointsParams {
  page?: number
  /** Endpoints per page (the API caps this at 50). */
  perPage?: number
}

/** Configuration for the server SDK client. */
export interface ArkycOptions {
  /** Project secret API key (`sk_…`). */
  secretKey: string
  /** API base URL (default `https://api.arkyc.toneflix.net`). */
  baseUrl?: string
  /**
   * Optional workflow applied to every session this client opens (the workflow's
   * ID, from the dashboard). Overridable per `sessions.create({ workflowId })`.
   */
  workflowId?: string | null
  /** Custom fetch implementation (defaults to global `fetch`). */
  fetch?: typeof fetch
}

/** Payload delivered when the widget flow completes. */
export interface WidgetResult {
  status: string
  [key: string]: unknown
}

/** A widget event delivered to {@link OpenWidgetOptions.onEvent} / `handle.on`. */
export interface WidgetEvent {
  /** Event name, e.g. `session.transition`, `complete`, `error`, `close`. */
  name: string
  /** Event payload (shape depends on `name`). */
  data?: unknown
}

/** Subscribe to a named widget event; returns an unsubscribe function. */
export type WidgetEventListener = (data: unknown) => void

/** Options for {@link ArkycWidget.open}. */
export interface OpenWidgetOptions {
  /** The session's client token (from `arkyc.sessions.create`). */
  token: string
  /** Hosted widget origin (default `https://arkyc.toneflix.net/verify`). */
  widgetUrl?: string
  /**
   * ISO 3166-1 alpha-2 country to preselect on the widget's country screen (e.g.
   * `NG`). The user can still change it.
   */
  defaultCountry?: string
  onComplete?: (result: WidgetResult) => void
  onError?: (error: unknown) => void
  onClose?: () => void
  /**
   * Firehose for live session events (`session.transition`) and lifecycle events
   * (`complete` / `error` / `close`), delivered from the hosted widget over
   * `postMessage`. Also subscribable per-name via {@link WidgetHandle.on}.
   */
  onEvent?: (event: WidgetEvent) => void
  /** Injectable for testing; defaults to the global `document`. */
  doc?: Document
  /** Injectable for testing; defaults to the global `window`. */
  win?: Window
}

/** A handle to the open widget. */
export interface WidgetHandle {
  close: () => void
  /**
   * Subscribe to a named widget event (e.g. `session.transition`, `complete`).
   * Returns an unsubscribe function.
   */
  on: (event: string, listener: WidgetEventListener) => () => void
}
