import type {
  DocumentType,
  LivenessChallenge,
  LivenessMode,
  ProjectBranding,
  VerificationStatus,
  WidgetResult,
  WidgetStep,
} from '@arkyc/types'
import { ArkycClient, type ClientSession, type ProviderSignalHints } from './client'
import type { FaceAnalyzer, FaceTuning } from './face'
import { Flow } from './flow'
import { Theme } from './theme'
import { WidgetView, type ViewHandlers } from './ui'

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
  /** Schedules a callback after `ms` (defaults to `setTimeout`). */
  scheduler?: (fn: () => void, ms: number) => void
  /** Cosmetic OCR-processing screen duration (ms). */
  transientMs?: number
  /** Delay between session polls while finalising (ms). */
  pollMs?: number
  /** Maximum number of polls before giving up and showing the last status. */
  maxPolls?: number
}

/**
 * Drives the full verification flow: renders each screen via {@link WidgetView},
 * advances through {@link flow}, and calls the Client API at each step. Cosmetic
 * processing screens auto-advance; capture screens wait for an image. On a
 * terminal result it surfaces the outcome and (in hosted mode) posts
 * `arkyc:complete` / `arkyc:error` / `arkyc:close` to the parent window.
 */
export class WidgetController {
  private readonly client: ArkycClient
  private readonly view: WidgetView
  private readonly win: Window
  private readonly postToParent: boolean
  private readonly scheduler: (fn: () => void, ms: number) => void
  private readonly transientMs: number
  private readonly pollMs: number
  private readonly maxPolls: number

  private step: WidgetStep = 'welcome'
  private documentType: DocumentType | null = null
  private country: string | null = null
  private selfie: Blob | null = null
  private livenessMode: LivenessMode = 'passive'
  private livenessChallenges: LivenessChallenge[] = []
  private result: WidgetResult | null = null
  private pendingError: Error | null = null
  private settled = false

  constructor(private readonly config: WidgetControllerConfig) {
    const doc = config.doc ?? globalThis.document
    const win = config.win ?? globalThis.window
    if (!doc || !win) throw new Error('The Arkyc widget must run in a browser environment.')
    this.win = win

    this.client = new ArkycClient({
      token: config.token,
      baseUrl: config.baseUrl,
      fetch: config.fetch,
    })
    const theme = new Theme(config.branding)
    this.view = new WidgetView(
      doc,
      theme,
      this.handlers(),
      config.nav ?? globalThis.navigator,
      config.faceAnalyzer,
      config.faceTuning,
    )

    this.postToParent = config.postToParent ?? (!!win.parent && win.parent !== win)
    this.scheduler = config.scheduler ?? ((fn, ms) => setTimeout(fn, ms))
    this.transientMs = config.transientMs ?? 700
    this.pollMs = config.pollMs ?? 1500
    this.maxPolls = config.maxPolls ?? 40
  }

  /** The widget's root element — append it to an overlay or inline container. */
  get element(): HTMLElement {
    return this.view.element
  }

  /** Render the initial (welcome) screen. */
  start(): void {
    this.render()
  }

  /** Tear down the view and release the camera (does not fire callbacks). */
  destroy(): void {
    this.view.destroy()
  }

  /** Close the widget as if the user dismissed it (fires `onClose`/`onSettle`). */
  close(): void {
    this.finishClose()
  }

  private handlers(): ViewHandlers {
    return {
      onClose: () => this.finishClose(),
      onStart: () =>
        void this.run(async () => {
          const session = await this.client.getSession()
          this.resolveLiveness(session)
          await this.enter(this.next())
        }),
      onDocumentSelected: (type, country) => {
        this.documentType = type
        this.country = country || null
        void this.run(() => this.enter('front_capture'))
      },
      onImage: (blob) => void this.run(() => this.onImage(blob)),
      onActiveLiveness: (video, performed) =>
        void this.run(async () => {
          await this.client.submitLiveness({
            video,
            mode: 'active',
            challenges: performed,
            signals: this.config.signals,
          })
          await this.enter(this.next())
        }),
      onAcknowledge: () => this.finishResult(),
    }
  }

  /** Resolve which liveness flow to run from the session's capture model. */
  private resolveLiveness(session: ClientSession): void {
    this.livenessChallenges = session.liveness_challenges ?? []
    const model = session.capture_model ?? 'passive'
    const wantsActive = model === 'active' || model === 'both'
    // `active` is honoured even without a live camera (a file-fallback finish);
    // `both` falls back to passive when the camera/recorder isn't available.
    this.livenessMode = wantsActive && (model === 'active' || this.view.cameraSupported) ? 'active' : 'passive'
  }

  private async onImage(blob: Blob | null): Promise<void> {
    const signals = this.config.signals
    switch (this.step) {
      case 'front_capture':
        await this.client.submitDocumentFront({
          image: blob,
          country: this.country,
          documentType: this.documentType,
          signals,
        })
        return this.enter(this.next())
      case 'back_capture':
        await this.client.submitDocumentBack({
          image: blob,
          country: this.country,
          documentType: this.documentType,
        })
        return this.enter('ocr_processing')
      case 'selfie_capture':
        this.selfie = blob
        return this.enter('passive_liveness')
    }
  }

  /** Enter a step: render it, and drive any automatic (processing) work. */
  private async enter(step: WidgetStep): Promise<void> {
    if (this.settled) return
    this.step = step
    this.render()

    switch (step) {
      case 'ocr_processing':
        await this.delay(this.transientMs)
        return this.enter(this.next())
      case 'passive_liveness':
        await this.client.submitLiveness({ selfie: this.selfie, signals: this.config.signals })
        return this.enter(this.next())
      case 'face_match':
        await this.client.complete({ signals: this.config.signals })
        return this.enter(this.next())
      case 'processing':
        return this.poll()
    }
  }

  /** Poll the session until it reaches a terminal status (then show the result). */
  private async poll(): Promise<void> {
    for (let i = 0; i < this.maxPolls && !this.settled; i++) {
      const session = await this.client.getSession()
      if (Flow.isTerminal(session.status)) return this.showResult(session.status)
      await this.delay(this.pollMs)
    }
    // Still processing after the poll budget — surface as pending review.
    this.showResult('requires_review')
  }

  private showResult(status: VerificationStatus): void {
    this.result = { status, decision: Flow.statusToDecision(status) }
    this.step = 'result'
    this.render()
  }

  private render(): void {
    this.view.render({
      step: this.step,
      documentType: this.documentType,
      decision: this.result?.decision,
      allowSkip: !!this.config.signals,
      livenessChallenges: this.livenessChallenges,
    })
  }

  private next(): WidgetStep {
    return Flow.nextStep(this.step, {
      documentType: this.documentType,
      livenessMode: this.livenessMode,
    })
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => this.scheduler(resolve, ms))
  }

  /** Run an async step, routing any failure to the error screen. */
  private async run(fn: () => Promise<void> | void): Promise<void> {
    try {
      await fn()
    } catch (error) {
      this.fail(error)
    }
  }

  private fail(error: unknown): void {
    if (this.settled) return
    const err = error instanceof Error ? error : new Error(String(error))
    this.step = 'result'
    this.view.render({
      step: 'result',
      documentType: this.documentType,
      errorMessage: err.message,
    })
    this.pendingError = err
  }

  private finishResult(): void {
    if (this.settled) return
    this.settled = true
    if (this.pendingError) {
      this.post('arkyc:error', { error: serializeError(this.pendingError) })
      this.config.onError?.(this.pendingError)
    } else if (this.result) {
      this.post('arkyc:complete', { payload: this.result })
      this.config.onComplete?.(this.result)
    }
    this.destroy()
    this.config.onSettle?.()
  }

  private finishClose(): void {
    if (this.settled) return
    this.settled = true
    this.post('arkyc:close', {})
    this.config.onClose?.()
    this.destroy()
    this.config.onSettle?.()
  }

  private post(type: string, extra: Record<string, unknown>): void {
    if (!this.postToParent) return
    try {
      this.win.parent?.postMessage({ type, ...extra }, '*')
    } catch {
      // Cross-origin parent without access — nothing more we can do.
    }
  }
}

function serializeError(error: Error): { message: string; name: string } {
  return { message: error.message, name: error.name }
}
