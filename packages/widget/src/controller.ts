import type {
  DocumentType,
  LivenessChallenge,
  LivenessMode,
  SessionTransitionEvent,
  VerificationStatus,
  WidgetResult,
  WidgetStep,
  WorkflowConfig,
} from '@arkyc/types'
import { REALTIME_EVENT, workflowAddressConfig } from '@arkyc/types'
import { ArkycClient, type ClientHandoff, type ClientRealtime, type ClientSession, WidgetApiError } from './client'
import { Flow } from './flow'
import { Theme } from './theme'
import { WidgetView, type AddressFormData, type ViewHandlers } from './ui'
import { isDesktopDevice } from './device'
import { renderQrSvg } from './qr'
import { createWidgetRealtimeClient, type WidgetRealtimeClient } from './realtime'
import type { BaseWidgetOptions, WidgetControllerConfig, WidgetEventListener } from './types'

/** Per-step lead-in copy shown before each capture/liveness step. */
const STEP_INSTRUCTIONS: Partial<Record<WidgetStep, { title: string; body: string; cta?: string }>> = {
  front_capture: {
    title: 'Front of your document',
    body: 'Place the front of your ID flat and fully inside the frame. We’ll capture it automatically.',
  },
  back_capture: {
    title: 'Back of your document',
    body: 'Now turn your ID over and show the back, fully inside the frame.',
  },
  selfie_capture: {
    title: 'Take a selfie',
    body: 'Look straight at the camera in good light and hold still — we’ll capture it automatically.',
  },
  active_liveness: {
    title: 'Quick liveness check',
    body: 'Follow the on-screen prompts (such as turn your head, blink or smile). This confirms you’re really here.',
  },
}

/**
 * Drives the full verification flow: renders each screen via {@link WidgetView},
 * advances through {@link flow}, and calls the Client API at each step. Cosmetic
 * processing screens auto-advance; capture screens wait for an image. On a
 * terminal result it surfaces the outcome and (in hosted mode) posts
 * `arkyc:complete` / `arkyc:error` / `arkyc:close` to the parent window.
 */
/**
 * Re-base the server-resolved project logo onto the API origin the widget is
 * actually talking to. The stored `logo_url` carries the API's own host, which a
 * handed-off phone cannot reach — it reaches the API through the absolute
 * `baseUrl` passed in the handoff link. Rewriting the origin (keeping the path)
 * makes the logo load on whatever device runs the widget. Only applied when
 * `baseUrl` is absolute; the integrator's own branding is never re-based.
 */
function rebaseBrandingLogo<T extends { logo_url?: string | null }>(branding: T, baseUrl: string | undefined): T {
  const logo = branding.logo_url
  if (!logo || !baseUrl || !/^https?:\/\//i.test(baseUrl)) return branding
  try {
    const base = new URL(baseUrl)
    const resolved = new URL(logo, base)
    if (resolved.origin === base.origin) return branding
    return { ...branding, logo_url: `${base.origin}${resolved.pathname}${resolved.search}${resolved.hash}` }
  } catch {
    return branding
  }
}

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

  /** This session's id + how to watch it live (push transport vs. polling). */
  private sessionId = ''
  private realtimeConfig: ClientRealtime | null = null
  private rtClient: WidgetRealtimeClient | null = null
  private rtResolved = false
  /** The last status observed, so a transition only emits once per change. */
  private lastStatus: VerificationStatus | null = null
  /** Per-name event listeners registered via {@link on}. */
  private listeners = new Map<string, Set<WidgetEventListener>>()
  /** Cancels the active session watch (e.g. continue-on-this-device). */
  private stopWatch: (() => void) | undefined

  private step: WidgetStep = 'welcome'
  private documentType: DocumentType | null = null
  private country: string | null = null
  private selfie: Blob | null = null
  private livenessMode: LivenessMode = 'passive'
  /** The session's capture model; `active` mandates a live camera (no fallback). */
  private captureModel: 'passive' | 'active' | 'both' = 'passive'
  private livenessChallenges: LivenessChallenge[] = []
  /** The address-entry form data, captured before the address submission. */
  private addressData: AddressFormData | null = null
  /** Device coordinates resolved on the address step (when the user opts in). */
  private addressCoords: { latitude: number; longitude: number } | null = null
  /** The applied workflow (orders/toggles stages, skip_ocr), or null for the default flow. */
  private workflow: WorkflowConfig | null = null
  private result: WidgetResult | null = null
  /** The session was already terminal when the widget loaded (show a close-only notice). */
  private terminalOnLoad = false
  /** Whether the current step's instruction interstitial has been acknowledged. */
  private instructionAcked = false
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

  /** Connect to the session, then route to the result, the QR, or the welcome flow. */
  start(): void {
    this.view.renderLoading()
    void this.run(() => this.bootstrap())
  }

  /** Tear down the view and release the camera (does not fire callbacks). */
  destroy(): void {
    this.view.destroy()
  }

  /** Close the widget as if the user dismissed it (fires `onClose`/`onSettle`). */
  close(): void {
    this.finishClose()
  }

  /**
   * Subscribe to a named widget event; returns an unsubscribe function. Having a
   * listener (here or via `onEvent`) is what activates the event stream.
   */
  on(event: string, listener: WidgetEventListener): () => void {
    const set = this.listeners.get(event) ?? new Set<WidgetEventListener>()
    set.add(listener)
    this.listeners.set(event, set)

    return () => set.delete(listener)
  }

  /** Whether anyone is listening for `name` (the firehose or a named listener). */
  private hasListener(name: string): boolean {
    if (this.config.onEvent) return true
    const set = this.listeners.get(name)

    return !!set && set.size > 0
  }

  /**
   * Surface an event: to local listeners (firehose + `on`), and — in hosted
   * iframe mode — to the embedding parent as `arkyc:event` so the SDK's
   * `handle.on(...)` works across the frame.
   */
  private dispatch(name: string, data?: unknown): void {
    this.emit(name, data)
    // The parent window is the consumer in iframe mode, so forwarding there isn't
    // gated on a local listener (post() already no-ops when not embedding).
    this.post('arkyc:event', { name, data })
  }

  /** Emit an event to the firehose + named listeners — but only if one is active. */
  private emit(name: string, data?: unknown): void {
    if (!this.hasListener(name)) return
    try {
      this.config.onEvent?.({ name, data })
    } catch {
      // A consumer callback threw — never let it break the flow.
    }
    const set = this.listeners.get(name)
    if (set) {
      for (const listener of [...set]) {
        try {
          listener(data)
        } catch {
          // ditto
        }
      }
    }
  }

  /** Record an observed status, emitting `session.transition` on a real change. */
  private observe(status: VerificationStatus): void {
    if (status === this.lastStatus) return
    const previous = this.lastStatus
    this.lastStatus = status
    this.dispatch(REALTIME_EVENT.sessionTransition, {
      session_id: this.sessionId,
      status,
      previous_status: previous,
    } satisfies Partial<SessionTransitionEvent>)
  }

  /**
   * Lazily connect the push transport for this session (once). Returns null for
   * `polling`/`off`/`memory` or when the transport SDK can't load — the caller
   * then polls instead.
   */
  private async resolveRealtime(): Promise<WidgetRealtimeClient | null> {
    if (this.rtResolved) return this.rtClient
    this.rtResolved = true
    const cfg = this.realtimeConfig
    if (!cfg || cfg.transport === 'polling' || cfg.transport === 'off' || cfg.transport === 'memory') return null

    const factory = this.config.realtimeFactory ?? createWidgetRealtimeClient
    const apiBase = (this.config.baseUrl ?? '').replace(/\/$/, '')
    try {
      this.rtClient = await factory(cfg, {
        authEndpoint: `${apiBase}/v1/client/realtime/auth`,
        token: this.config.token,
      })
    } catch {
      this.rtClient = null
    }

    return this.rtClient
  }

  private handlers(): ViewHandlers {
    return {
      onClose: () => this.finishClose(),
      // The session was already fetched + resolved during bootstrap; just advance.
      onStart: () => void this.run(() => this.enter(this.next())),
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
      onAddress: (data) => void this.run(() => this.onAddress(data)),
      onAcknowledge: () => this.finishResult(),
      onUsePhone: () => void this.run(() => this.startHandoff()),
      onContinueHere: () => {
        this.handoffActive = false
        this.stopWatch?.()
        this.step = 'welcome'
        this.render()
      },
    }
  }

  /**
   * Fetch the session and route: an already-terminal session (e.g. a stale handoff
   * link, or one finished on another device) shows a close-only notice; on a
   * desktop with handoff enabled we lead with the QR; otherwise the welcome flow.
   */
  private async bootstrap(): Promise<void> {
    if (this.settled) return
    const session = await this.client.getSession()
    if (this.settled) return
    this.sessionId = session.id
    this.realtimeConfig = session.realtime ?? null
    this.workflow = session.workflow ?? null
    // Theme from the project's branding (server-resolved) unless the integrator
    // passed branding explicitly — their value wins.
    if (this.config.branding == null && session.branding)
      this.view.applyBranding(rebaseBrandingLogo(session.branding, this.config.baseUrl))
    this.observe(session.status)
    if (Flow.isTerminal(session.status)) return this.showTerminal(session.status)
    this.resolveLiveness(session)
    if (session.handoff) this.handoffConfig = session.handoff
    const canHandoff =
      this.config.handoff !== false && isDesktopDevice(this.nav) && this.handoffConfig.enabled && !!this.handoffTarget()
    if (canHandoff) {
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

  /** Watch the session while the user verifies on the other device; mirror the result. */
  private async pollHandoff(): Promise<void> {
    const rt = await this.resolveRealtime()
    if (rt) {
      const status = await this.pushWatch(rt, this.maxHandoffPolls, () => this.handoffActive && !this.settled)
      if (status) {
        this.handoffActive = false
        return this.showResult(status)
      }

      return // cancelled (continue here) or budget elapsed → the QR persists
    }

    let errors = 0
    for (let i = 0; i < this.maxHandoffPolls && this.handoffActive && !this.settled; i++) {
      await this.delay(this.pollMs)
      if (!this.handoffActive || this.settled) return
      try {
        const session = await this.client.getSession()
        errors = 0
        this.observe(session.status)
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

  /**
   * Await a terminal status over the push transport. Resolves to the terminal
   * status, or null if `active()` went false or the tick budget elapsed (push can
   * miss events / disconnect; the budget bounds the wait). An initial fetch
   * catches a session that finished before we subscribed.
   */
  private pushWatch(
    rt: WidgetRealtimeClient,
    budget: number,
    active: () => boolean,
  ): Promise<VerificationStatus | null> {
    return new Promise((resolve) => {
      let done = false
      const finish = (status: VerificationStatus | null) => {
        if (done) return
        done = true
        this.stopWatch = undefined
        unsubscribe()
        resolve(status)
      }
      const channel = this.realtimeConfig!.channel
      const unsubscribe = rt.subscribe(channel, (event, data) => {
        if (event !== REALTIME_EVENT.sessionTransition) return
        const status = (data as SessionTransitionEvent).status
        this.observe(status)
        if (Flow.isTerminal(status)) finish(status)
      })
      this.stopWatch = () => finish(null)
      // Catch a race where the session already finished before we subscribed.
      void this.client
        .getSession()
        .then((session) => {
          this.observe(session.status)
          if (Flow.isTerminal(session.status)) finish(session.status)
        })
        .catch((error) => {
          if (error instanceof WidgetApiError && error.status === 401) finish('expired')
        })
      // Bound the wait by the same tick budget the poller would use.
      const countdown = async (n: number): Promise<void> => {
        if (done) return
        if (!active() || n >= budget) return finish(null)
        await this.delay(this.pollMs)
        void countdown(n + 1)
      }
      void countdown(0)
    })
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

    // Lead each capture/liveness step with an instruction screen so the user
    // knows what's next and starts it deliberately. The Continue button re-enters
    // the same step with the instruction acknowledged.
    const instruction = STEP_INSTRUCTIONS[step]
    if (instruction && !this.instructionAcked) {
      this.view.renderInstruction(step, instruction.title, instruction.body, instruction.cta ?? 'Continue', () => {
        this.instructionAcked = true
        void this.run(() => this.enter(step))
      })
      return
    }
    this.instructionAcked = false
    this.render()

    switch (step) {
      case 'ocr_processing':
        await this.delay(this.transientMs)
        return this.enter(this.next())
      case 'address_processing':
        await this.submitAddress()
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

  /** Watch the session until it reaches a terminal status (then show the result). */
  private async poll(): Promise<void> {
    const rt = await this.resolveRealtime()
    if (rt) {
      const status = await this.pushWatch(rt, this.maxPolls, () => !this.settled)

      return this.showResult(status ?? 'requires_review')
    }

    for (let i = 0; i < this.maxPolls && !this.settled; i++) {
      const session = await this.client.getSession()
      this.observe(session.status)
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

  /** A session that was already terminal on load: a notice with only a Close button. */
  private showTerminal(status: VerificationStatus): void {
    this.result = { status, decision: Flow.statusToDecision(status) }
    this.step = 'result'
    this.terminalOnLoad = true
    this.render()
  }

  private render(): void {
    this.view.render({
      step: this.step,
      documentType: this.documentType,
      decision: this.result?.decision,
      status: this.result?.status,
      terminalNotice: this.terminalOnLoad,
      allowSkip: !!this.config.signals,
      livenessChallenges: this.livenessChallenges,
      requireLiveCamera: this.captureModel === 'active',
      // The active flow is strict end-to-end: documents must be detected, not
      // manually waved through.
      strictCapture: this.livenessMode === 'active',
      handoffAvailable: this.handoffReady,
      addressMethods: workflowAddressConfig(this.workflow)?.methods ?? [],
    })
  }

  /** Store the entered address, resolve device location if opted in, then verify. */
  private async onAddress(data: AddressFormData): Promise<void> {
    this.addressData = data
    this.addressCoords = data.useLocation ? await this.geolocate() : null

    return this.enter('address_processing')
  }

  /** Submit the captured address evidence to the Client API. */
  private async submitAddress(): Promise<void> {
    const data = this.addressData
    if (!data) return

    await this.client.submitAddress({
      line1: data.line1,
      line2: data.line2,
      city: data.city,
      region: data.region,
      postalCode: data.postalCode,
      country: data.country,
      poa: data.poa,
      latitude: this.addressCoords?.latitude ?? null,
      longitude: this.addressCoords?.longitude ?? null,
      signals: this.config.signals,
    })
  }

  /**
   * Resolve the device's coordinates via the Geolocation API. Resolves to `null`
   * on denial/unavailability/timeout — the `device_location` method then simply
   * has no coordinates to check (routing the session to review).
   */
  private geolocate(): Promise<{ latitude: number; longitude: number } | null> {
    const geo = this.nav?.geolocation
    if (!geo) return Promise.resolve(null)

    return new Promise((resolve) => {
      geo.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
      )
    })
  }

  private next(): WidgetStep {
    return Flow.nextStep(this.step, {
      documentType: this.documentType,
      livenessMode: this.livenessMode,
      workflow: this.workflow,
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
    this.teardownRealtime()

    if (this.pendingError) {
      this.post('arkyc:error', { error: serializeError(this.pendingError) })
      this.dispatch('error', { message: this.pendingError.message })
      this.config.onError?.(this.pendingError)
    } else if (this.result) {
      this.post('arkyc:complete', { payload: this.result })
      this.dispatch('complete', this.result)
      this.config.onComplete?.(this.result)
    }

    this.destroy()
    this.config.onSettle?.()
  }

  private finishClose(): void {
    if (this.settled) return

    this.settled = true
    this.teardownRealtime()
    this.post('arkyc:close', {})
    this.dispatch('close')
    this.config.onClose?.()
    this.destroy()
    this.config.onSettle?.()
  }

  /** Stop any active session watch + disconnect the push transport. */
  private teardownRealtime(): void {
    this.stopWatch?.()
    this.rtClient?.disconnect()
    this.rtClient = null
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
    onEvent: options.onEvent,
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
