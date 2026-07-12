import type { DocumentAnalyzer, DocumentTuning } from './document'
import type {
  DocumentType,
  LivenessChallenge,
  ProjectBranding,
  SessionTransitionEvent,
  WidgetResult,
} from '@arkyc/types'
import type { FaceAnalyzer, FaceTuning } from './face'

import type { AddressFormData } from './ui'
import type { ProviderSignalHints } from './client'
import type { WidgetRealtimeFactory } from './realtime'

export interface RgbData {
  obj: { r: number; g: number; b: number }
  str: string
}

/**
 * Payload for `session.transition` — a live verification status change relayed
 * from the configured transport (pusher/firebase/polling). A widget-scoped
 * subset of the server's {@link SessionTransitionEvent} (no org/project ids).
 */
export type WidgetSessionTransitionData = Pick<
  SessionTransitionEvent,
  'session_id' | 'status' | 'previous_status'
>

/**
 * Payload for `error` — a non-terminal failure surfaced as it happens (an
 * expired session/token becomes knowable without waiting for the user to
 * dismiss the screen). `status`/`error` are present only for typed API errors.
 */
export interface WidgetErrorData {
  /** Human-readable failure message. */
  message: string
  /** HTTP status code, when the failure came from a typed API error. */
  status?: number
  /** Stable machine-readable error key, when the failure came from a typed API error. */
  error?: string
}

/**
 * The set of widget events and the payload each delivers. This is the single
 * source of truth for event names and their `data` shapes: `onEvent`,
 * {@link WidgetEvent}, {@link WidgetEventListener}, and {@link WidgetHandle.on}
 * are all derived from it, so a listener's `data` is typed from the name.
 */
export interface WidgetEventMap {
  /** Live status change (fires on every real transition, once per change). */
  'session.transition': WidgetSessionTransitionData
  /** The flow settled successfully; carries the final verification result. */
  complete: WidgetResult
  /** A failure occurred (may be recoverable; the flow has not necessarily ended). */
  error: WidgetErrorData
  /** The widget was closed (camera released). No payload. */
  close: undefined
}

/** A widget event name — one of the keys of {@link WidgetEventMap}. */
export type WidgetEventName = keyof WidgetEventMap

/**
 * An event surfaced to consumers through `onEvent`. Discriminated on `name`, so
 * a `switch (event.name)` narrows `event.data` to the matching payload. The
 * stream is a firehose: `session.transition` (live status changes) plus the
 * lifecycle events `complete` / `error` / `close`.
 */
export type WidgetEvent = {
  [K in WidgetEventName]: {
    /** Event name (discriminant). */
    name: K
    /** Event payload for this `name` (see {@link WidgetEventMap}). */
    data: WidgetEventMap[K]
  }
}[WidgetEventName]

/**
 * Subscribe callback for a single named widget event; receives that event's
 * payload (typed from the name via {@link WidgetEventMap}). Defaults to the
 * union of all payloads when the name isn't fixed.
 */
export type WidgetEventListener<K extends WidgetEventName = WidgetEventName> = (
  data: WidgetEventMap[K],
) => void

/** Configuration for a {@link WidgetController}. */
export interface WidgetControllerConfig {
  /** Short-lived client token for this session. */
  token: string
  /** API origin (defaults to the widget's own origin). */
  baseUrl?: string
  /** Disable cross-device handoff entirely (set on the hosted page to avoid recursion). */
  handoff?: boolean
  /** Override the server-provided handoff page URL. */
  handoffUrl?: string
  branding?: ProjectBranding | null
  /**
   * Mock-driver signal hints. When present, capture screens also offer a
   * "Skip" affordance (the `mock` drivers can decide without a real image).
   */
  signals?: ProviderSignalHints
  onComplete?: (result: WidgetResult) => void
  onError?: (error: Error) => void
  onClose?: () => void
  /**
   * Firehose for every widget event (`session.transition`, `complete`, `error`,
   * `close`). Nothing is emitted unless this or a `handle.on(...)` listener is
   * active. The same stream is filterable per-name via {@link WidgetHandle.on}.
   */
  onEvent?: (event: WidgetEvent) => void
  /** Fired once the flow settles (complete/error/close); used to remove the host. */
  onSettle?: () => void
  /** Force (or disable) posting `arkyc:*` messages to `window.parent`. */
  postToParent?: boolean

  // Injectables (testing / non-browser hosts).
  fetch?: typeof fetch
  doc?: Document
  win?: Window
  nav?: Navigator
  /**
   * Face analyzer powering selfie auto-capture + active-liveness detection.
   * Defaults to the real MediaPipe-backed analyzer (loaded lazily from a CDN);
   * pass `null` to disable detection and use the manual capture flow.
   */
  faceAnalyzer?: FaceAnalyzer | null
  /** Override face-detection thresholds (tune against a real camera). */
  faceTuning?: FaceTuning
  /**
   * Document analyzer powering document auto-capture (real edge-projection
   * detection). Defaults to the built-in canvas detector; pass `null` to disable
   * it and fall back to the brightness/glare heuristic.
   */
  documentAnalyzer?: DocumentAnalyzer | null
  /** Override document-detection thresholds (tune against a real camera). */
  documentTuning?: DocumentTuning
  /**
   * Builds the realtime push client from the session's realtime config. Defaults
   * to the bundled pusher/firebase factory; injectable for tests.
   */
  realtimeFactory?: WidgetRealtimeFactory
  /** Schedules a callback after `ms` (defaults to `setTimeout`). */
  scheduler?: (fn: () => void, ms: number) => void
  /** Cosmetic OCR-processing screen duration (ms). */
  transientMs?: number
  /** Delay between session polls while finalising (ms). */
  pollMs?: number
  /** Maximum number of polls before giving up and showing the last status. */
  maxPolls?: number
  /** Maximum number of polls while waiting on a handed-off device (bounded by session TTL). */
  maxHandoffPolls?: number
}

/** Common options shared by every launch mode. */
export interface BaseWidgetOptions {
  /** Short-lived client token minted by the integrator's backend. */
  token: string
  /** API origin (defaults to the page's own origin). */
  baseUrl?: string
  /**
   * Cross-device handoff (desktop → phone via QR) is on by default and uses a
   * first-party hosted page the API points to — integrators host nothing. Set
   * `false` to disable it (the hosted page itself does, to avoid recursion).
   */
  handoff?: boolean
  /**
   * Override the hosted handoff page URL. By default the widget uses the URL the
   * API returns (the dashboard's `/verify` page); only set this for custom hosting.
   */
  handoffUrl?: string
  /** Branding (colors, logo, radius, theme, name). Usually sourced from project config. */
  branding?: ProjectBranding | null
  /**
   * Open the widget edge-to-edge (no surrounding padding/backdrop gap, no card
   * max-size or border radius). Applies to {@link ArkycWidget.open} only.
   */
  fullscreen?: boolean
  /** Mock-driver signal hints; enables a "Skip" affordance on capture screens. */
  signals?: ProviderSignalHints
  onComplete?: (result: WidgetResult) => void
  onError?: (error: Error) => void
  onClose?: () => void
  /**
   * Firehose for live session events (`session.transition`) and lifecycle events
   * (`complete` / `error` / `close`). Whether updates arrive via pusher, firebase
   * or polling is decided by the platform's configured transport — the widget
   * handles it. Nothing is emitted unless this (or a `handle.on(...)`) is active.
   */
  onEvent?: (event: WidgetEvent) => void

  // Injectables (testing / non-browser hosts).
  fetch?: typeof fetch
  doc?: Document
  win?: Window
  nav?: Navigator
  /** Pass `null` to disable face detection (selfie auto-capture + active liveness). */
  faceAnalyzer?: FaceAnalyzer | null
  /** Override face-detection thresholds (tune against a real camera). */
  faceTuning?: FaceTuning
  /** Pass `null` to disable document detection (falls back to the brightness heuristic). */
  documentAnalyzer?: DocumentAnalyzer | null
  /** Override document-detection thresholds (tune against a real camera). */
  documentTuning?: DocumentTuning
}

/** Options for {@link ArkycWidget.mount} (inline mode). */
export interface MountWidgetOptions extends BaseWidgetOptions {
  /** Element (or selector) to mount the widget into. */
  container: string | HTMLElement
}

/** A handle to an open/mounted widget. */
export interface WidgetHandle {
  /** Close the widget and release the camera (fires `onClose`). */
  close: () => void
  /**
   * Subscribe to a named widget event (`session.transition`, `complete`,
   * `error`, `close`). The `listener`'s `data` is typed from the `event` name
   * via {@link WidgetEventMap}. Returns an unsubscribe function. Registering a
   * listener activates the event stream (events are only delivered while at
   * least one listener is active).
   */
  on: <K extends WidgetEventName>(event: K, listener: WidgetEventListener<K>) => () => void
}

/** High-level events the view raises back to the controller. */
export interface ViewHandlers {
  onClose(): void
  onStart(): void
  onDocumentSelected(type: DocumentType, country: string): void
  /** A capture screen produced an image (or `null` when skipped in demo mode). */
  onImage(blob: Blob | null): void
  /**
   * Active liveness finished: the recorded video (or `null`), the performed
   * sequence, and a still selfie frame grabbed from the live video (or `null`).
   */
  onActiveLiveness(video: Blob | null, performed: LivenessChallenge[], selfie?: Blob | null): void
  /** The result screen was acknowledged ("Done"). */
  onAcknowledge(): void
  /** The user chose to continue the verification on another device (handoff). */
  onUsePhone(): void
  /** The user chose to keep verifying on this (desktop) device instead of handing off. */
  onContinueHere(): void
  /** The address-entry form was submitted (opt-in address stage). */
  onAddress(data: AddressFormData): void
  /** Request the device's location (address stage); resolves true when shared. */
  onShareLocation(): boolean | Promise<boolean>
}
