import type { DocumentAnalyzer, DocumentTuning } from './document'
import type { FaceAnalyzer, FaceTuning } from './face'
import type { ProjectBranding, WidgetResult } from '@arkyc/types'

import type { ProviderSignalHints } from './client'

/** Configuration for a {@link WidgetController}. */
export interface WidgetControllerConfig {
  /** Short-lived client token for this session. */
  token: string
  /** API origin (defaults to the widget's own origin). */
  baseUrl?: string
  branding?: ProjectBranding | null
  /**
   * Mock-driver signal hints. When present, capture screens also offer a
   * "Skip" affordance (the `mock` drivers can decide without a real image).
   */
  signals?: ProviderSignalHints
  onComplete?: (result: WidgetResult) => void
  onError?: (error: Error) => void
  onClose?: () => void
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
  /** Schedules a callback after `ms` (defaults to `setTimeout`). */
  scheduler?: (fn: () => void, ms: number) => void
  /** Cosmetic OCR-processing screen duration (ms). */
  transientMs?: number
  /** Delay between session polls while finalising (ms). */
  pollMs?: number
  /** Maximum number of polls before giving up and showing the last status. */
  maxPolls?: number
}


/** Common options shared by every launch mode. */
export interface BaseWidgetOptions {
  /** Short-lived client token minted by the integrator's backend. */
  token: string
  /** API origin (defaults to the page's own origin). */
  baseUrl?: string
  /** Branding (colors, logo, radius, theme). Usually sourced from project config. */
  branding?: ProjectBranding | null
  /** Mock-driver signal hints; enables a "Skip" affordance on capture screens. */
  signals?: ProviderSignalHints
  onComplete?: (result: WidgetResult) => void
  onError?: (error: Error) => void
  onClose?: () => void

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
}

/** Common options shared by every launch mode. */
export interface BaseWidgetOptions {
  /** Short-lived client token minted by the integrator's backend. */
  token: string
  /** API origin (defaults to the page's own origin). */
  baseUrl?: string
  /** Branding (colors, logo, radius, theme). Usually sourced from project config. */
  branding?: ProjectBranding | null
  /** Mock-driver signal hints; enables a "Skip" affordance on capture screens. */
  signals?: ProviderSignalHints
  onComplete?: (result: WidgetResult) => void
  onError?: (error: Error) => void
  onClose?: () => void

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
