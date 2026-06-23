import type {
  DocumentType,
  LivenessChallenge,
  LivenessMode,
  VerificationStatus,
  WidgetResult,
  WidgetStep,
} from '@arkyc/types'
import { ArkycClient, type ClientHandoff, type ClientSession, WidgetApiError } from './client'
import { Flow } from './flow'
import { Theme } from './theme'
import { WidgetView, type ViewHandlers } from './ui'
import { isDesktopDevice } from './device'
import { renderQrSvg } from './qr'
import type { BaseWidgetOptions, WidgetControllerConfig } from './types'

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
  private readonly nav: Navigator
  private readonly postToParent: boolean
  private readonly scheduler: (fn: () => void, ms: number) => void
  private readonly transientMs: number
  private readonly pollMs: number
  private readonly maxPolls: number
  private readonly maxHandoffPolls: number

  /** Cross-device handoff: project config + whether the offer/QR is showing. */
  private handoffConfig: ClientHandoff = { enabled: false, allow_desktop: true, url: '' }
  private handoffReady = false
  private handoffActive = false

  private step: WidgetStep = 'welcome'
  private documentType: DocumentType | null = null
  private country: string | null = null
  private selfie: Blob | null = null
  private livenessMode: LivenessMode = 'passive'
  /** The session's capture model; `active` mandates a live camera (no fallback). */
  private captureModel: 'passive' | 'active' | 'both' = 'passive'
  private livenessChallenges: LivenessChallenge[] = []
  private result: WidgetResult | null = null
  private pendingError: Error | null = null
  private settled = false

  constructor(private readonly config: WidgetControllerConfig) {
    const doc = config.doc ?? globalThis.document
    const win = config.win ?? globalThis.window
    if (!doc || !win) throw new Error('The Arkyc widget must run in a browser environment.')
    this.win = win
    this.nav = config.nav ?? globalThis.navigator

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
      config.documentAnalyzer,
      config.documentTuning,
    )

    this.postToParent = config.postToParent ?? (!!win.parent && win.parent !== win)
    this.scheduler = config.scheduler ?? ((fn, ms) => setTimeout(fn, ms))
    this.transientMs = config.transientMs ?? 700
    this.pollMs = config.pollMs ?? 1500
    this.maxPolls = config.maxPolls ?? 40
    // A handed-off session is bounded by its TTL (~15 min); poll generously.
    this.maxHandoffPolls = config.maxHandoffPolls ?? 600
  }

  /** The widget's root element — append it to an overlay or inline container. */
  get element(): HTMLElement {
    return this.view.element
  }

  /** Render the initial screen (QR-first on desktop when handoff is enabled). */
  start(): void {
    // On a desktop the phone has the better camera, so when the project enables
    // handoff we lead with the QR. The enabled flag comes from the server, so on
    // desktop we show a brief connecting screen, fetch the config, then route to
    // the QR or the normal welcome flow. Mobile (and hosted pages) start at welcome.
    if (this.config.handoff !== false && isDesktopDevice(this.nav)) {
      this.view.renderLoading()
      void this.run(() => this.bootstrapDesktop())
      return
    }
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
      onActiveLiveness: (video, performed, selfie) =>
        void this.run(async () => {
          await this.client.submitLiveness({
            selfie,
            video,
            mode: 'active',
            challenges: performed,
            signals: this.config.signals,
          })
          await this.enter(this.next())
        }),
      onAcknowledge: () => this.finishResult(),
      onUsePhone: () => void this.run(() => this.startHandoff()),
      onContinueHere: () => {
        this.handoffActive = false
        this.step = 'welcome'
        this.render()
      },
    }
  }

  /**
   * Desktop bootstrap: fetch the session to learn the project's handoff config,
   * then lead with the QR when enabled (otherwise fall through to welcome). On a
   * phone this path isn't taken — handoff has no value there.
   */
  private async bootstrapDesktop(): Promise<void> {
    if (this.settled) return
    const session = await this.client.getSession()
    this.resolveLiveness(session)
    if (session.handoff) this.handoffConfig = session.handoff
    if (this.handoffConfig.enabled && this.handoffTarget()) {
      this.handoffReady = true
      await this.startHandoff()
    } else {
      this.step = 'welcome'
      this.render()
    }
  }

  /** The hosted handoff page URL: a consumer override, else the server-provided one. */
  private handoffTarget(): string {
    return (this.config.handoffUrl ?? this.handoffConfig.url ?? '').trim()
  }

  /** Render the QR for this session and wait for the other device to finish. */
  private async startHandoff(): Promise<void> {
    const target = this.handoffTarget()
    if (!target) return
    this.handoffActive = true
    // Offer "continue on this device" only when the project permits it.
    this.view.renderHandoff(renderQrSvg(this.buildHandoffUrl(target)), this.handoffConfig.allow_desktop)
    await this.pollHandoff()
  }

  /** Build the hosted-page URL the QR encodes (carries the session token). */
  private buildHandoffUrl(target: string): string {
    const sep = target.includes('?') ? '&' : '?'
    let url = `${target}${sep}token=${encodeURIComponent(this.config.token)}`
    // The hosted page supplies its own API base; only pass one when ours is
    // absolute, so a custom cross-origin host can still reach the right API.
    const apiBase = (this.config.baseUrl ?? '').trim()
    if (/^https?:\/\//i.test(apiBase)) url += `&baseUrl=${encodeURIComponent(apiBase)}`
    return url
  }

  /** Poll the session while the user verifies on the other device; mirror the result. */
  private async pollHandoff(): Promise<void> {
    let errors = 0
    for (let i = 0; i < this.maxHandoffPolls && this.handoffActive && !this.settled; i++) {
      await this.delay(this.pollMs)
      if (!this.handoffActive || this.settled) return
      try {
        const session = await this.client.getSession()
        errors = 0
        if (Flow.isTerminal(session.status)) {
          this.handoffActive = false
          return this.showResult(session.status)
        }
      } catch (error) {
        // The session/token can expire mid-wait (401) — stop and reflect that.
        if (error instanceof WidgetApiError && error.status === 401) {
          this.handoffActive = false
          return this.showResult('expired')
        }
        if (++errors >= 5) return
      }
    }
  }

  /** Resolve which liveness flow to run from the session's capture model. */
  private resolveLiveness(session: ClientSession): void {
    this.livenessChallenges = session.liveness_challenges ?? []
    const model = session.capture_model ?? 'passive'
    this.captureModel = model
    const wantsActive = model === 'active' || model === 'both'
    // `active` is honoured even without a live camera — the active-liveness
    // screen then shows the device as unsupported (no fallback). `both` falls
    // back to passive when the camera/recorder isn't available.
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
      requireLiveCamera: this.captureModel === 'active',
      // The active flow is strict end-to-end: documents must be detected, not
      // manually waved through.
      strictCapture: this.livenessMode === 'active',
      handoffAvailable: this.handoffReady,
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

export const resolveContainer = (container: string | HTMLElement, doc: Document): HTMLElement => {
  const el = typeof container === 'string' ? doc.querySelector<HTMLElement>(container) : container
  if (!el) throw new Error(`ArkycWidget.mount: container "${String(container)}" not found.`)
  return el
}

export const buildController = (options: BaseWidgetOptions, onSettle: () => void): WidgetController => {
  if (!options.token) throw new Error('ArkycWidget requires a client `token`.')
  return new WidgetController({
    token: options.token,
    baseUrl: options.baseUrl,
    handoff: options.handoff,
    handoffUrl: options.handoffUrl,
    branding: options.branding,
    signals: options.signals,
    onComplete: options.onComplete,
    onError: options.onError,
    onClose: options.onClose,
    onSettle,
    fetch: options.fetch,
    doc: options.doc,
    win: options.win,
    nav: options.nav,
    faceAnalyzer: options.faceAnalyzer,
    faceTuning: options.faceTuning,
    documentAnalyzer: options.documentAnalyzer,
    documentTuning: options.documentTuning,
  })
}
