import type {
  AddressMethod,
  DocumentType,
  LivenessChallenge,
  ProjectBranding,
  VerificationDecision,
  VerificationStatus,
  WidgetStep,
} from '@arkyc/types'

/** The data the address-entry screen collects before submission. */
export interface AddressFormData {
  line1: string | null
  line2: string | null
  city: string | null
  region: string | null
  postalCode: string | null
  country: string | null
  /** Proof-of-address image, when the `poa_document` method is configured. */
  poa: Blob | null
  /** Whether the user opted to share device location (`device_location` method). */
  useLocation: boolean
}

import { Camera } from './capture'
import type { Facing } from './capture'
import {
  createDefaultDocumentAnalyzer,
  DEFAULT_DOCUMENT_TUNING,
  documentGuidance,
  type DocRect,
  type DocumentAnalyzer,
  type DocumentTuning,
} from './document'
import {
  createDefaultFaceAnalyzer,
  DEFAULT_TUNING,
  isSelfieReady,
  makeChallengeDetector,
  type FaceAnalyzer,
  type FaceTuning,
} from './face'
import { Theme } from './theme'
import { countries } from './countries'
import { createDom, type Dom } from './h'
import type { ViewHandlers } from './types'

/** Per-render data the view needs for the current step. */
export interface ViewState {
  step: WidgetStep
  documentType: DocumentType | null
  decision?: VerificationDecision | null
  /** The session status (drives the close-only terminal notice). */
  status?: VerificationStatus
  /** Render the result as a close-only notice (session was already terminal on load). */
  terminalNotice?: boolean
  statusLabel?: string
  errorMessage?: string
  /** Show a "Skip" affordance on capture screens (demo / mock-driver flows). */
  allowSkip?: boolean
  /** The challenge sequence to prompt for the active-liveness screen. */
  livenessChallenges?: LivenessChallenge[]
  /** The address methods to collect for, on the address-entry screen. */
  addressMethods?: AddressMethod[]
  /**
   * Capture model demands a live camera (`capture_model === 'active'`). When set,
   * the active-liveness screen must NOT offer a manual/file fallback on
   * unsupported devices — it shows an "unsupported device" message instead.
   */
  requireLiveCamera?: boolean
  /**
   * The session runs the active flow (resolved liveness is `active`). Document
   * capture is then strict: detection-gated auto-capture only — no manual capture
   * button, no permissive brightness/upload fallback that could bypass detection.
   */
  strictCapture?: boolean
  /** Offer a "Continue on your phone" affordance on the welcome screen (handoff). */
  handoffAvailable?: boolean
}

const DOCUMENT_LABELS: Record<DocumentType, string> = {
  passport: 'Passport',
  id_card: 'ID Card',
  drivers_license: "Driver's License",
  residence_permit: 'Residence Permit',
}

const CHALLENGE_LABELS: Record<LivenessChallenge, string> = {
  turn_left: 'Slowly turn your head to the left, and hold',
  turn_right: 'Slowly turn your head to the right, and hold',
  blink: 'Blink slowly',
  smile: 'Smile, and hold it',
  nod: 'Slowly nod your head',
  move_closer: 'Slowly move closer to the camera',
}

interface Notice {
  cls: string
  icon: string
  title: string
  copy: string
}

/** Fallback notice for an expired/unknown terminal session. */
const EXPIRED_NOTICE: Notice = {
  cls: 'warn',
  icon: '⏳',
  title: 'Link expired',
  copy: 'This verification link has expired.',
}

/** Close-only notice copy for a session that was already terminal on load. */
const TERMINAL_NOTICE: Partial<Record<VerificationStatus, Notice>> = {
  approved: { cls: 'ok', icon: '✓', title: 'Already complete', copy: 'This verification has already been completed.' },
  rejected: { cls: 'ok', icon: '✓', title: 'Already complete', copy: 'This verification has already been completed.' },
  requires_review: {
    cls: 'ok',
    icon: '✓',
    title: 'Already complete',
    copy: 'This verification has already been submitted and is being reviewed.',
  },
  expired: EXPIRED_NOTICE,
  cancelled: { cls: 'warn', icon: '⏳', title: 'Cancelled', copy: 'This verification was cancelled.' },
}

const SVG = (body: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`

/** Per-challenge directional cue icons, animated via CSS over the preview. */
const CUE_ICONS: Record<LivenessChallenge, string> = {
  turn_right: SVG('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  turn_left: SVG('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
  nod: SVG('<path d="M12 5v14M6 13l6 6 6-6"/>'),
  move_closer: SVG('<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
  blink: SVG('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  smile: SVG('<path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/>'),
}

const CHECK_ICON = SVG('<path d="M20 6 9 17l-5-5"/>')

/** Larger line-art illustration used to dress the informative / lead-in screens. */
const ART = (body: string) =>
  `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`

/** Per-screen decorative illustrations, keyed by step (plus a welcome hero). */
const STEP_ART: Partial<Record<WidgetStep | 'welcome', string>> = {
  // Shield with a check — trust / "verify your identity".
  welcome: ART(
    '<path d="M32 7 52 14v14c0 12.5-8.2 21.6-20 25.6C20.2 49.6 12 40.5 12 28V14z"/><path d="M23 30.5l6.2 6.2L41 24.5"/>',
  ),
  // ID card with a portrait + text lines.
  front_capture: ART(
    '<rect x="7" y="15" width="50" height="34" rx="5"/><circle cx="22" cy="28" r="5"/><path d="M14 42c1-5 5-7 8-7s7 2 8 7"/><path d="M38 27h12M38 34h12M38 41h8"/>',
  ),
  // ID card flipped: magnetic stripe + MRZ lines.
  back_capture: ART(
    '<rect x="7" y="15" width="50" height="34" rx="5"/><rect x="7" y="20" width="50" height="6" fill="currentColor" stroke="none" opacity=".18"/><path d="M14 34h36M14 41h24"/>',
  ),
  // A person centred in a camera viewfinder (corner brackets).
  selfie_capture: ART(
    '<path d="M10 20v-6a4 4 0 0 1 4-4h6"/><path d="M44 10h6a4 4 0 0 1 4 4v6"/><path d="M54 44v6a4 4 0 0 1-4 4h-6"/><path d="M20 54h-6a4 4 0 0 1-4-4v-6"/><circle cx="32" cy="27" r="8"/><path d="M19 50c0-7 6-11 13-11s13 4 13 11"/>',
  ),
  // A smiling face with turn-your-head arrows on each side.
  active_liveness: ART(
    '<circle cx="32" cy="30" r="13"/><circle cx="27" cy="27" r="1.2" fill="currentColor" stroke="none"/><circle cx="37" cy="27" r="1.2" fill="currentColor" stroke="none"/><path d="M26 34c2 2.5 10 2.5 12 0"/><path d="M13 30H6M10 26l-4 4 4 4"/><path d="M51 30h7M54 26l4 4-4 4"/>',
  ),
}

/** Handles for driving the circular preview overlay (ring + cue + success check). */
interface FaceStage {
  stage: HTMLElement
  /** 0–1 fill of the progress ring. */
  setProgress(p: number): void
  /** Visual state: searching, holding (green), or completed (check). */
  setState(state: 'wait' | 'good' | 'done'): void
  /** Show a challenge cue icon (or clear it with `null`). */
  setCue(challenge: LivenessChallenge | null): void
}

/** Handles for driving the document preview overlay (bracket frame + scan line). */
interface DocStage {
  stage: HTMLElement
  /** Tint the frame for the current capture quality. */
  setQuality(quality: 'wait' | 'good' | 'bad'): void
  /** Flag whether a document is currently detected (brightens the fixed guide). */
  setFrame(rect: DocRect | null): void
}

/** Handles for driving the liveness step-progress dots. */
interface StepDots {
  el: HTMLElement
  /** Mark the given step index as the active one. */
  setActive(index: number): void
  /** Mark the given step index as completed. */
  markDone(index: number): void
}

/**
 * Renders the widget's screens into a host element. DOM- and camera-injectable
 * so it can run under a fake DOM in tests. The view owns capture-screen camera
 * mechanics and raises only high-level events to the controller.
 */
export class WidgetView {
  private readonly root: HTMLElement
  private readonly body: HTMLElement
  private readonly footer: HTMLElement
  /** The `<style>` carrying the theme's CSS vars; swapped on runtime re-brand. */
  private readonly styleEl: HTMLElement
  /** The header brand group (logo/name/title); rebuilt on runtime re-brand. */
  private readonly brandEl: HTMLElement
  private readonly camera: Camera
  private readonly analyzer: FaceAnalyzer | null
  private readonly tuning: FaceTuning
  private readonly docAnalyzer: DocumentAnalyzer | null
  private readonly docTuning: DocumentTuning
  /** Interval ids for live quality/recording timers, cleared on re-render. */
  private timers: ReturnType<typeof setInterval>[] = []
  /** Extra teardown run on each re-render (cancels in-flight detection loops). */
  private cleanups: (() => void)[] = []
  /** DOM hyperscript helpers (`h`/`append`/`field`) bound to this view's document (see {@link createDom}). */
  private readonly dom: Dom

  constructor(
    private readonly doc: Document,
    private theme: Theme,
    private readonly handlers: ViewHandlers,
    nav: Navigator = globalThis.navigator,
    analyzer: FaceAnalyzer | null = createDefaultFaceAnalyzer(),
    tuning: FaceTuning = DEFAULT_TUNING,
    docAnalyzer: DocumentAnalyzer | null = createDefaultDocumentAnalyzer(),
    docTuning: DocumentTuning = DEFAULT_DOCUMENT_TUNING,
  ) {
    this.dom = createDom(doc)
    this.camera = new Camera(doc, nav)
    this.analyzer = analyzer
    this.tuning = tuning
    this.docAnalyzer = docAnalyzer
    this.docTuning = docTuning
    this.root = this.dom.h('div', { class: 'arkyc-root' })

    this.styleEl = this.dom.h('style', { text: theme.stylesheet() })
    this.root.appendChild(this.styleEl)

    this.brandEl = this.dom.h('div', { class: 'arkyc-brand' })
    this.fillBrand()
    this.body = this.dom.h('div', { class: 'arkyc-body' })
    this.footer = this.dom.h('div', { class: 'arkyc-footer' })

    const header = this.dom.h('div', { class: 'arkyc-header' }, [
      this.brandEl,
      this.dom.h('button', {
        class: 'arkyc-close',
        html: '&times;',
        'aria-label': 'Close',
        on: { click: () => this.handlers.onClose() },
      }),
    ])

    this.root.appendChild(this.dom.h('div', { class: 'arkyc-card' }, [header, this.body, this.footer]))
  }

  /**
   * Populate the header brand group from the current theme: the project logo
   * and/or name when branding is shown, otherwise a neutral title.
   */
  private fillBrand(): void {
    this.clear(this.brandEl)
    const lastTenMins = Date.now() - Math.floor(Math.random() * (10 * 60 * 1000))
    const branded = this.theme.showBranding && (this.theme.logoUrl || this.theme.name)

    this.dom.append(
      this.brandEl,
      branded
        ? [
            this.theme.logoUrl &&
              this.dom.h('img', { class: 'arkyc-logo', src: `${this.theme.logoUrl}?stamp=${lastTenMins}` }),
            this.theme.name && this.dom.h('span', { class: 'arkyc-brand-name', text: this.theme.name }),
          ]
        : this.dom.h('p', { class: 'arkyc-title', text: 'Verify your identity' }),
    )
  }

  /**
   * Re-theme the widget at runtime from project branding (resolved server-side):
   * swap the CSS-variable stylesheet (colours/radius) and rebuild the header
   * brand (logo/name). Cascades to every already-rendered element via the vars.
   */
  applyBranding(branding: ProjectBranding | null): void {
    this.theme = new Theme(branding)
    this.styleEl.textContent = this.theme.stylesheet()
    this.fillBrand()
  }

  /**
   * The widget's root element — append this to the overlay / container.
   */
  get element(): HTMLElement {
    return this.root
  }

  /**
   * Whether live camera capture is available (drives the active-liveness branch).
   */
  get cameraSupported(): boolean {
    return this.camera.supported
  }

  /**
   * Release any active camera stream and clear live timers.
   */
  destroy(): void {
    this.timers.forEach((id) => clearInterval(id))
    this.timers = []
    this.cleanups.forEach((fn) => fn())
    this.cleanups = []
    this.camera.stop()
  }

  /**
   * Render the screen for the given state.
   *
   * @param state
   * @returns
   */
  render(state: ViewState): void {
    this.destroy()
    this.clear(this.body)
    this.clear(this.footer)
    this.root.classList.remove('arkyc-handoff')

    switch (state.step) {
      case 'welcome':
        return this.renderWelcome(state.handoffAvailable)
      case 'document_selection':
        return this.renderDocumentSelection()
      case 'front_capture':
        return this.renderCapture('Front of document', 'environment', state.allowSkip, false, state.strictCapture)
      case 'back_capture':
        return this.renderCapture('Back of document', 'environment', state.allowSkip, false, state.strictCapture)
      case 'selfie_capture':
        return this.renderCapture('Take a selfie', 'user', state.allowSkip, true, state.strictCapture)
      case 'active_liveness':
        return this.renderActiveLiveness(state.livenessChallenges ?? [], state.allowSkip, state.requireLiveCamera)
      case 'ocr_processing':
        return this.renderProcessing('Reading your document…')
      case 'address_entry':
        return this.renderAddressForm(state.addressMethods ?? [])
      case 'address_processing':
        return this.renderProcessing('Verifying your address…')
      case 'passive_liveness':
        return this.renderProcessing('Checking liveness…')
      case 'face_match':
        return this.renderProcessing('Matching your face…')
      case 'processing':
        return this.renderProcessing(state.statusLabel ?? 'Finalising verification…')
      case 'result':
        return this.renderResult(state.decision ?? null, state.errorMessage, {
          terminal: state.terminalNotice,
          status: state.status,
        })
    }
  }

  /** Prepend a decorative illustration for the given screen, when one exists. */
  private appendArt(key: WidgetStep | 'welcome'): void {
    const art = STEP_ART[key]
    if (art) this.body.appendChild(this.dom.h('div', { class: 'arkyc-illus', html: art }))
  }

  private renderWelcome(handoffAvailable?: boolean): void {
    this.appendArt('welcome')
    this.dom.append(this.body, [
      this.dom.h('h2', { class: 'arkyc-h', text: 'Verify your identity' }),
      this.dom.h('p', {
        class: 'arkyc-p',
        text: 'You will need a government-issued ID and a moment to take a selfie. Your data is processed securely.',
      }),
    ])
    this.dom.append(this.footer, [
      this.button('Get started', () => this.handlers.onStart()),
      handoffAvailable && this.button('Continue on your phone', () => this.handlers.onUsePhone(), 'arkyc-btn-ghost'),
    ])
  }

  /** A neutral connecting screen shown while the widget bootstraps the session. */
  renderLoading(label = 'Loading…'): void {
    this.destroy()
    this.clear(this.body)
    this.clear(this.footer)
    this.root.classList.remove('arkyc-handoff')
    this.renderProcessing(label)
  }

  /**
   * An interstitial that tells the user what the next step is, with a single
   * Continue button — so each step starts deliberately rather than the camera
   * springing to life unannounced.
   */
  renderInstruction(step: WidgetStep, title: string, body: string, cta: string, onContinue: () => void): void {
    this.destroy()
    this.clear(this.body)
    this.clear(this.footer)
    this.root.classList.remove('arkyc-handoff')
    this.appendArt(step)
    this.dom.append(this.body, [
      this.dom.h('h2', { class: 'arkyc-h', text: title }),
      this.dom.h('p', { class: 'arkyc-p', text: body }),
    ])
    this.footer.appendChild(this.button(cta, onContinue))
  }

  /**
   * Show the cross-device handoff QR: the user scans it to resume this same
   * session on their phone. The widget then waits for the other device to finish.
   * `allowContinueHere` offers an escape hatch to keep verifying on this device.
   */
  renderHandoff(qrSvg: string, allowContinueHere: boolean): void {
    this.destroy()
    this.clear(this.body)
    this.clear(this.footer)
    // Keep the QR prominent (edge-to-edge in fullscreen) rather than a small dialog.
    this.root.classList.add('arkyc-handoff')
    this.dom.append(this.body, [
      this.dom.h('h2', { class: 'arkyc-h', text: 'Continue on your phone' }),
      this.dom.h('p', { class: 'arkyc-p', text: 'Scan this code with your phone camera to finish verifying there.' }),
      this.dom.h('div', { class: 'arkyc-qr', html: qrSvg }),
      this.dom.h('div', { class: 'arkyc-handoff-wait' }, [
        this.dom.h('div', { class: 'arkyc-spinner sm' }),
        this.dom.h('span', { text: 'Waiting for your phone…' }),
      ]),
    ])
    if (allowContinueHere) {
      this.footer.appendChild(
        this.button('Continue on this device', () => this.handlers.onContinueHere(), 'arkyc-btn-ghost'),
      )
    }
  }

  private renderDocumentSelection(): void {
    this.body.appendChild(this.dom.h('h2', { class: 'arkyc-h', text: 'Select your document' }))
    const country = this.dom.field('Country', {
      class: 'arkyc-btn arkyc-btn-ghost arkyc-text-center',
      name: 'country',
      autocomplete: 'country',
      choices: countries.map(({ name, iso2, flag }) => ({ value: iso2, label: `${flag} ${name}` })),
    })

    const buttons = (Object.keys(DOCUMENT_LABELS) as DocumentType[]).map((type) => {
      const btn = this.button(DOCUMENT_LABELS[type], () =>
        this.handlers.onDocumentSelected(type, (country.value || '').trim().toUpperCase()),
      )
      btn.classList.add('arkyc-btn-ghost')
      return btn
    })

    this.body.appendChild(this.dom.h('div', { class: 'arkyc-choices' }, [country, ...buttons]))
  }

  private renderCapture(title: string, facing: Facing, allowSkip?: boolean, selfie = false, strict = false): void {
    // Documents in the active flow are strict: detection-gated only (no manual
    // bypass). Selfies are always pure auto, so strictness only changes documents.
    const strictDoc = strict && !selfie
    const fileInput = this.dom.h<HTMLInputElement>('input', {
      type: 'file',
      accept: 'image/*',
      class: 'arkyc-hidden',
      on: { change: () => this.handlers.onImage(Camera.fileFromInput(fileInput)) },
    })
    this.dom.append(this.body, [
      this.dom.h('h2', { class: 'arkyc-h', text: title }),
      this.dom.h('p', { class: 'arkyc-p', text: 'Position it clearly in frame, then capture.' }),
      fileInput,
    ])

    if (this.camera.supported) {
      const video = this.dom.h('video', {
        class: `arkyc-preview${selfie ? ' selfie' : ''}`,
      }) as HTMLVideoElement

      // Wrap the preview in its animated overlay (circular ring for selfies,
      // bracket frame for documents).
      const face = selfie ? this.buildFaceStage(video) : null
      const doc = selfie ? null : this.buildDocStage(video)
      const mount = face?.stage ?? doc!.stage
      this.body.appendChild(mount)

      // Live guidance hint (quality for documents, framing for selfies).
      const hint = this.dom.h('p', { class: 'arkyc-p arkyc-hint' }) as HTMLParagraphElement
      this.body.appendChild(hint)

      // After a capture, wait for an explicit "Continue" so the user can review
      // and get ready for the next step — never auto-advance. Swap the live
      // preview for a still of the captured frame: this shows exactly what was
      // captured and removes the overlay (brackets / scan line / ring) entirely,
      // rather than leaving a stopped (black) video with animations still running.
      const confirmCapture = (blob: Blob | null) => {
        this.destroy() // stop the camera + detection timers
        if (blob) {
          const url = URL.createObjectURL(blob)
          const still = this.dom.h('img', {
            class: `arkyc-preview${selfie ? ' selfie' : ''}`,
            src: url,
          }) as HTMLImageElement
          mount.replaceWith(still)
          this.cleanups.push(() => URL.revokeObjectURL(url))
        } else {
          mount.classList.add('arkyc-hidden')
        }
        this.clear(this.footer)
        hint.textContent = '✓ Captured'
        this.footer.appendChild(this.button('Continue', () => this.handlers.onImage(blob)))
        const retake = this.button('Retake', () => {
          this.destroy()
          this.clear(this.body)
          this.clear(this.footer)
          this.renderCapture(title, facing, allowSkip, selfie, strict)
        })
        retake.classList.add('arkyc-btn-ghost')
        this.footer.appendChild(retake)
      }

      const onCapture = () => void this.camera.grabFrame(video).then(confirmCapture)

      void this.camera.start(video, facing).catch(() => {
        mount.classList.add('arkyc-hidden')
        if (strictDoc) {
          // Strict document capture: no file fallback — a live camera is required.
          hint.textContent = 'Camera access is required to scan your document. Please allow access and try again.'
          return
        }
        // Camera denied/unavailable — fall back to the file input.
        fileInput.click()
      })

      if (selfie) {
        // Pure auto-capture: face detection grabs the frame when the user is
        // framed. The manual button only appears if the detector can't load.
        this.runSelfieAutoCapture(video, hint, onCapture, face!)
      } else {
        this.runDocumentAutoCapture(video, hint, doc!, strictDoc, onCapture)
        // Passive model only: a manual capture button as a reliable override.
        // The active flow is detection-gated — no manual bypass.
        if (!strictDoc) this.footer.appendChild(this.button('Capture', onCapture))
      }
    } else if (strictDoc) {
      // Strict document capture with no camera — surface as unsupported.
      this.dom.append(this.body, [
        this.dom.h('div', { class: 'arkyc-badge err', html: '!' }),
        this.dom.h('p', {
          class: 'arkyc-p',
          text: 'This step needs a working camera to scan your document. Please retry on a device with a camera.',
        }),
      ])
    } else {
      const upload = this.button('Upload photo', () => fileInput.click())
      this.footer.appendChild(upload)
    }

    if (allowSkip) {
      const skip = this.button('Skip (demo)', () => this.handlers.onImage(null))
      skip.classList.add('arkyc-btn-ghost')
      this.footer.appendChild(skip)
    }
  }

  /**
   * Run `cb` once the live camera feed appears (the video has frames). The
   * detection model may still be downloading at that point, so callers use this
   * to replace the "starting camera" hint with a neutral one.
   *
   * @param video
   * @param cb
   */
  private onCameraLive(video: HTMLVideoElement, cb: () => void): void {
    if ((video.readyState ?? 0) >= 2) {
      cb()
      return
    }
    video.addEventListener('playing', cb, { once: true })
  }

  /**
   * Document capture: detect a real, well-framed, in-focus document (edge
   * projection) and auto-grab only once it's been held steady. Falls back to the
   * brightness/glare heuristic when the detector can't run.
   *
   * @param video
   * @returns
   */
  private runDocumentAutoCapture(
    video: HTMLVideoElement,
    hint: HTMLElement,
    doc: DocStage,
    strict: boolean,
    capture: () => void,
  ): void {
    // In strict mode the permissive brightness heuristic is disabled — it can't
    // tell a document from a well-lit blank frame, which would defeat detection.
    const onNoDetector = () => {
      if (strict) {
        hint.textContent = 'Document scanning isn’t available on this device.'
        return
      }
      this.runDocumentBrightnessCapture(video, hint, doc, capture)
    }

    const analyzer = this.docAnalyzer
    if (!analyzer) return onNoDetector()

    hint.textContent = 'Starting camera…'
    let cancelled = false
    let modelReady = false
    this.cleanups.push(() => {
      cancelled = true
    })
    // The camera feed appears before the document scanner model finishes loading;
    // once the video is live, stop implying the camera is still starting.
    this.onCameraLive(video, () => {
      if (!cancelled && !modelReady) hint.textContent = 'Getting ready…'
    })
    void analyzer.ready().then((ok) => {
      modelReady = true
      if (cancelled) return
      if (!ok) {
        onNoDetector()
        return
      }
      let goodStreak = 0
      // Smooth the noisiest geometry signals (fill/edge strength) across frames so a
      // single jittery edge-projection read doesn't flip the hint to "move closer"
      // and reset the streak. Exponential moving average; null until the first frame.
      let fillEma: number | null = null
      let edgeEma: number | null = null
      const ema = (prev: number | null, next: number) => (prev == null ? next : prev * 0.6 + next * 0.4)
      const timer = setInterval(() => {
        const sample = analyzer.analyze(video)
        if (!sample) return
        fillEma = ema(fillEma, sample.fill)
        edgeEma = ema(edgeEma, sample.edgeStrength)
        const smoothed = { ...sample, fill: fillEma, edgeStrength: edgeEma }
        const { ready, hint: message } = documentGuidance(smoothed, this.docTuning)
        hint.textContent = message
        doc.setFrame(sample.present ? sample.rect : null)
        doc.setQuality(ready ? 'good' : sample.present ? 'wait' : 'bad')
        // Soft reset: a single off frame nudges the streak down rather than zeroing
        // it, so transient detector noise doesn't perpetually restart the hold.
        goodStreak = ready ? goodStreak + 1 : Math.max(0, goodStreak - 1)
        // Auto-capture once a framed, focused document has held for ~1.25s.
        if (goodStreak >= this.docTuning.hold) {
          clearInterval(timer)
          doc.setQuality('good')
          capture()
        }
      }, 250)
      this.timers.push(timer)
    })
  }

  /**
   * Coarse fallback: brightness/glare heuristic, used when detection can't run.
   *
   * @param video
   * @param hint
   * @param doc
   */
  private runDocumentBrightnessCapture(
    video: HTMLVideoElement,
    hint: HTMLElement,
    doc: DocStage,
    capture: () => void,
  ): void {
    let goodStreak = 0
    const timer = setInterval(() => {
      const quality = this.camera.sampleQuality(video)
      if (!quality) return
      if (quality.tooDark) {
        hint.textContent = 'Too dark — find better lighting'
        goodStreak = 0
        doc.setQuality('bad')
      } else if (quality.glare) {
        hint.textContent = 'Reduce glare on the document'
        goodStreak = 0
        doc.setQuality('bad')
      } else {
        hint.textContent = 'Looks good — hold steady'
        goodStreak += 1
        doc.setQuality('good')
      }
      // Auto-capture a steady document after ~1.5s of good quality.
      if (goodStreak >= 5) {
        clearInterval(timer)
        capture()
      }
    }, 300)
    this.timers.push(timer)
  }

  /**
   * Selfie capture: when face detection is available, auto-grab once a centred
   * face is held steady. Falls back to a brightness hint (manual capture) when
   * the detector can't load (unsupported browser / offline / test host).
   *
   * @param video
   * @param hint
   * @param capture
   * @returns
   */
  private runSelfieAutoCapture(video: HTMLVideoElement, hint: HTMLElement, capture: () => void, face: FaceStage): void {
    const analyzer = this.analyzer
    const addManualCapture = () => this.footer.appendChild(this.button('Capture', capture))
    if (!analyzer) {
      // No detector available — fall back to a manual capture button.
      hint.textContent = 'Center your face, then capture'
      addManualCapture()
      return
    }
    hint.textContent = 'Starting camera…'
    let cancelled = false
    let modelReady = false
    this.cleanups.push(() => {
      cancelled = true
    })
    // The camera feed appears before the detection model (MediaPipe WASM, lazily
    // fetched from a CDN) finishes loading. Once the video is live, stop implying
    // the camera is still starting.
    this.onCameraLive(video, () => {
      if (!cancelled && !modelReady) hint.textContent = 'Getting ready…'
    })
    void analyzer.ready().then((ok) => {
      modelReady = true
      if (cancelled) return
      if (!ok) {
        // Detector failed to load — guide with brightness and offer manual capture.
        hint.textContent = 'Center your face, then capture'
        addManualCapture()
        return
      }
      const need = 4
      let streak = 0
      const timer = setInterval(() => {
        const sample = analyzer.analyze(video)
        if (!sample || !sample.present) {
          hint.textContent = 'Position your face in the circle'
          streak = 0
          face.setState('wait')
          face.setProgress(0)
          return
        }
        if (isSelfieReady(sample, this.tuning)) {
          hint.textContent = 'Hold still…'
          streak += 1
          face.setState('good')
          face.setProgress(streak / need)
        } else {
          hint.textContent = sample.scale <= this.tuning.selfieMinScale ? 'Move a little closer' : 'Center your face'
          streak = 0
          face.setState('wait')
          face.setProgress(0)
        }
        if (streak >= need) {
          clearInterval(timer)
          face.setState('done')
          face.setProgress(1)
          capture()
        }
      }, 180)
      this.timers.push(timer)
    })
  }

  /**
   * Guided active-liveness screen: live front-camera preview, a recorded video,
   * and a sequence of challenge prompts the user advances through. The performed
   * sequence (the prompts shown, in order) is submitted for the driver to verify.
   *
   * @param video
   * @returns
   */
  private renderActiveLiveness(
    challenges: LivenessChallenge[],
    allowSkip?: boolean,
    requireLiveCamera?: boolean,
  ): void {
    const prompt = this.dom.h('p', {
      class: 'arkyc-p',
      text: 'Follow the on-screen prompts. Keep your face centred in the circle.',
    })
    this.dom.append(this.body, [this.dom.h('h2', { class: 'arkyc-h', text: 'Liveness check' }), prompt])

    const fileFallback = !this.camera.supported || !this.camera.canRecord

    if (fileFallback) {
      if (requireLiveCamera) {
        // capture_model = active: a live camera is mandatory. Do NOT offer a
        // manual "I did it" path — surface the device as unsupported instead.
        this.body.appendChild(this.dom.h('div', { class: 'arkyc-badge err', html: '!' }))
        prompt.textContent =
          'This check needs camera access on a supported device. Please retry on a device with a working camera.'
        if (allowSkip) {
          const skip = this.button('Skip (demo)', () => this.handlers.onActiveLiveness(null, challenges))
          skip.classList.add('arkyc-btn-ghost')
          this.footer.appendChild(skip)
        }
        return
      }
      // No camera/recorder — let the user finish (or skip) without a video.
      const finish = this.button('I performed the steps', () => this.handlers.onActiveLiveness(null, challenges))
      this.footer.appendChild(finish)
      if (allowSkip) {
        const skip = this.button('Skip (demo)', () => this.handlers.onActiveLiveness(null, challenges))
        skip.classList.add('arkyc-btn-ghost')
        this.footer.appendChild(skip)
      }
      return
    }

    const video = this.dom.h<HTMLVideoElement>('video', { class: 'arkyc-preview selfie' })
    const face = this.buildFaceStage(video)
    const dots = this.buildDots(challenges.length)
    this.dom.append(this.body, [challenges.length > 1 && dots.el, face.stage])

    let recording: { stop(): Promise<Blob> } | null = null
    let index = 0
    // The challenges the user actually completed, in order (detected or advanced).
    const performed: LivenessChallenge[] = []
    let detector = makeChallengeDetector(challenges[0] ?? 'blink', this.tuning)

    const showPrompt = (done = false) => {
      const challenge = challenges[index]
      if (!challenge) {
        prompt.textContent = 'Hold still…'
        return
      }
      prompt.textContent = done
        ? `✓ ${CHALLENGE_LABELS[challenge]}`
        : `Step ${index + 1} of ${challenges.length}: ${CHALLENGE_LABELS[challenge]}`
    }

    // Arm the overlay for the current challenge: show its cue, reset the ring,
    // and highlight the active step dot.
    const armChallenge = () => {
      face.setCue(challenges[index] ?? null)
      face.setState('wait')
      face.setProgress(0)
      dots.setActive(index)
    }

    const finish = () => {
      advance.setAttribute('disabled', 'true')
      // Grab a still selfie from the live video before stopping the recorder, so
      // active liveness yields a face image for review + face matching.
      void this.camera
        .grabFrame(video)
        .then((selfie) =>
          Promise.resolve(recording?.stop() ?? Promise.resolve(null)).then((blob) =>
            this.handlers.onActiveLiveness(blob, performed, selfie),
          ),
        )
    }

    const advanceStep = () => {
      if (index >= challenges.length) return
      const current = challenges[index]
      if (current) performed.push(current)
      dots.markDone(index)
      index += 1
      if (index >= challenges.length) {
        finish()
        return
      }
      detector = makeChallengeDetector(challenges[index]!, this.tuning)
      showPrompt()
      armChallenge()
      if (index === challenges.length - 1) advance.textContent = 'Finish'
    }

    // Manual advance is only revealed as a fallback when detection can't run.
    const advance = this.button('Next', () => advanceStep())
    if (challenges.length <= 1) advance.textContent = 'Finish'
    let manualShown = false
    const showManualAdvance = () => {
      if (manualShown) return
      manualShown = true
      this.footer.appendChild(advance)
    }

    void this.camera
      .start(video, 'user')
      .then((stream) => {
        recording = this.camera.recordStart(stream)
        showPrompt()
        armChallenge()

        // Real detection when available: auto-advance only when the prompted
        // challenge is actually performed. Reveals the manual button if the
        // detector is absent or fails to load.
        const analyzer = this.analyzer
        if (!analyzer) {
          showManualAdvance()
          return
        }
        let cancelled = false
        this.cleanups.push(() => {
          cancelled = true
        })
        void analyzer.ready().then((ok) => {
          if (cancelled) return
          if (!ok) {
            showManualAdvance()
            return
          }
          // While the success check is held, pause detection so the next cue
          // doesn't flash in before the user sees the confirmation.
          let flashing = false
          const timer = setInterval(() => {
            if (index >= challenges.length) {
              clearInterval(timer)
              return
            }
            if (flashing) return
            const sample = analyzer.analyze(video)
            if (!sample) return
            const hit = detector.feed(sample)
            face.setProgress(detector.progress)
            if (hit) {
              face.setState('done')
              showPrompt(true)
              flashing = true
              const to = setTimeout(() => {
                flashing = false
                advanceStep()
              }, 650)
              this.cleanups.push(() => clearTimeout(to))
            } else {
              face.setState(detector.progress > 0 ? 'good' : 'wait')
            }
          }, 160)
          this.timers.push(timer)
        })
      })
      .catch(() => {
        face.stage.classList.add('arkyc-hidden')
        if (requireLiveCamera) {
          // Mandatory live camera was denied — require a retry, don't fall back.
          prompt.textContent = 'Camera access is required to continue. Please allow access and try again.'
          return
        }
        this.handlers.onActiveLiveness(null, challenges)
      })

    if (allowSkip) {
      const skip = this.button('Skip (demo)', () => this.handlers.onActiveLiveness(null, challenges))
      skip.classList.add('arkyc-btn-ghost')
      this.footer.appendChild(skip)
    }
  }

  /**
   * Build the circular selfie/liveness preview overlay: an SVG progress ring, a
   * gesture-cue layer, and a success checkmark — driven via the returned handles.
   *
   * @param video
   * @returns
   */
  private buildFaceStage(video: HTMLVideoElement): FaceStage {
    const ring = this.dom.h('div', {
      class: 'arkyc-ring',
      html: '<svg viewBox="0 0 100 100"><circle class="arkyc-ring-track" cx="50" cy="50" r="46"/><circle class="arkyc-ring-arc" cx="50" cy="50" r="46"/></svg>',
    })
    const cue = this.dom.h('div', { class: 'arkyc-cue' })
    const stage = this.dom.h('div', { class: 'arkyc-stage', 'data-state': 'wait' }, [
      video,
      ring,
      cue,
      this.dom.h('div', { class: 'arkyc-check', html: CHECK_ICON }),
    ])

    const arc = ring.querySelector('.arkyc-ring-arc') as SVGCircleElement | null
    const circumference = 2 * Math.PI * 46
    if (arc) {
      arc.style.strokeDasharray = String(circumference)
      arc.style.strokeDashoffset = String(circumference)
    }

    return {
      stage,
      setProgress: (p) => {
        if (arc) arc.style.strokeDashoffset = String(circumference * (1 - Math.max(0, Math.min(1, p))))
      },
      setState: (state) => stage.setAttribute('data-state', state),
      setCue: (challenge) => {
        cue.className = 'arkyc-cue' + (challenge ? ` show arkyc-cue-${challenge}` : '')
        cue.innerHTML = challenge ? CUE_ICONS[challenge] : ''
      },
    }
  }

  /**
   * Build the liveness step-progress dots (one per challenge).
   *
   * @param video
   * @param hint
   * @param doc
   */
  private buildDots(count: number): StepDots {
    const dots = Array.from({ length: count }, () => this.dom.h('div', { class: 'arkyc-dot' }))
    const el = this.dom.h('div', { class: 'arkyc-dots' }, dots)
    return {
      el,
      setActive: (index) =>
        dots.forEach((d, i) => d.classList.toggle('active', i === index && !d.classList.contains('done'))),
      markDone: (index) => {
        const d = dots[index]
        if (d) {
          d.classList.remove('active')
          d.classList.add('done')
        }
      },
    }
  }

  /**
   * Build the document preview overlay: a fixed card-shaped alignment guide
   * (corner brackets + border) with an animated scan line. The guide is a target,
   * not a tracker — it stays put so the user aligns the card to it; detection only
   * tints it for quality and brightens it once a document is in view.
   *
   * @param video
   * @returns
   */
  private buildDocStage(video: HTMLVideoElement): DocStage {
    const frame = this.dom.h('div', { class: 'arkyc-doc-frame' }, [
      ...['tl', 'tr', 'bl', 'br'].map((corner) => this.dom.h('span', { class: `arkyc-corner ${corner}` })),
      this.dom.h('div', { class: 'arkyc-scan' }),
    ])
    const stage = this.dom.h('div', { class: 'arkyc-doc', 'data-q': 'wait' }, [video, frame])
    return {
      stage,
      setQuality: (quality) => stage.setAttribute('data-q', quality),
      // The guide never moves; a detected document only brightens it as feedback.
      setFrame: (rect) => stage.setAttribute('data-detected', rect ? 'true' : 'false'),
    }
  }

  private renderProcessing(label: string): void {
    this.dom.append(this.body, [
      this.dom.h('div', { class: 'arkyc-spinner' }),
      this.dom.h('p', { class: 'arkyc-p', text: label }),
    ])
  }

  private renderResult(
    decision: VerificationDecision | null,
    errorMessage?: string,
    opts: { terminal?: boolean; status?: VerificationStatus } = {},
  ): void {
    if (errorMessage) {
      this.dom.append(this.body, [
        this.dom.h('div', { class: 'arkyc-badge err', html: '!' }),
        this.dom.h('h2', { class: 'arkyc-h', text: 'Something went wrong' }),
        this.dom.h('p', { class: 'arkyc-p', text: errorMessage }),
      ])
    } else if (opts.terminal) {
      // The session was already finished/expired when this device opened it (e.g.
      // a stale handoff link). Show a notice, not the live result — and only Close.
      const n = TERMINAL_NOTICE[opts.status ?? 'expired'] ?? EXPIRED_NOTICE
      this.dom.append(this.body, [
        this.dom.h('div', { class: `arkyc-badge ${n.cls}`, text: n.icon }),
        this.dom.h('h2', { class: 'arkyc-h', text: n.title }),
        this.dom.h('p', { class: 'arkyc-p', text: n.copy }),
      ])
      this.footer.appendChild(this.button('Close', () => this.handlers.onClose()))
      return
    } else {
      const map = {
        approved: {
          cls: 'ok',
          icon: '✓',
          title: 'Verified',
          copy: 'Your identity has been verified.',
        },
        requires_review: {
          cls: 'warn',
          icon: '⏳',
          title: 'Under review',
          copy: 'Your verification is being reviewed. We will be in touch shortly.',
        },
        rejected: {
          cls: 'err',
          icon: '✕',
          title: 'Not verified',
          copy: 'We could not verify your identity. Please try again.',
        },
      } as const
      const r = map[decision ?? 'requires_review'] ?? map.requires_review
      this.dom.append(this.body, [
        this.dom.h('div', { class: `arkyc-badge ${r.cls}`, text: r.icon }),
        this.dom.h('h2', { class: 'arkyc-h', text: r.title }),
        this.dom.h('p', { class: 'arkyc-p', text: r.copy }),
      ])
    }
    this.footer.appendChild(this.button('Done', () => this.handlers.onAcknowledge()))
  }

  /**
   * The address-entry form (opt-in address stage). Inputs shown depend on methods.
   *
   * @param methods
   */
  private renderAddressForm(methods: AddressMethod[]): void {
    this.body.appendChild(this.dom.h('h2', { class: 'arkyc-h', text: 'Your address' }))
    this.body.appendChild(
      this.dom.h('p', { class: 'arkyc-p', text: 'Enter your residential address so we can verify it.' }),
    )

    const line1 = this.dom.field('Address line 1', { autocomplete: 'address-line1', name: 'street' })
    const line2 = this.dom.field('Address line 2 (optional)', { autocomplete: 'address-line2', name: 'town' })
    const city = this.dom.field('City', { autocomplete: 'address-level2', name: 'city' })
    const region = this.dom.field('State / region', { autocomplete: 'address-level1', name: 'state' })
    const postal = this.dom.field('ZIP/Postal code', { autocomplete: 'postal-code', name: 'zip' })
    const country = this.dom.field('Country', {
      name: 'country_iso2',
      choices: countries.map((e) => ({
        value: e.iso2,
        label: `${e.flag} ${e.name}`,
      })),
    })
    this.body.appendChild(
      this.dom.h('div', { class: 'arkyc-addr-form' }, [line1, line2, city, region, postal, country]),
    )

    let poa: Blob | null = null
    if (methods.includes('poa_document')) {
      const file = this.dom.h<HTMLInputElement>('input', {
        class: 'arkyc-addr-input',
        type: 'file',
        accept: 'image/*',
        on: { change: () => (poa = file.files?.[0] ?? null) },
      })
      this.dom.append(this.body, [
        this.dom.h('p', { class: 'arkyc-p', text: 'Upload a proof of address (utility bill or bank statement).' }),
        file,
      ])
    }

    let useLocation = false
    const requiresLocation = methods.includes('device_location')

    const submit = this.button('Continue', () =>
      this.handlers.onAddress({
        line1: line1.value.trim() || null,
        line2: line2.value.trim() || null,
        city: city.value.trim() || null,
        region: region.value.trim() || null,
        postalCode: postal.value.trim() || null,
        country: country.value.trim().toUpperCase() || null,
        poa,
        useLocation,
      }),
    )

    if (requiresLocation) {
      const status = this.dom.h('p', { class: 'arkyc-p' })
      const cb = this.dom.h<HTMLInputElement>('input', {
        type: 'checkbox',
        // Request location the moment they opt in, so the browser permission
        // prompt appears immediately (not silently at submit) — and show the result.
        on: {
          change: () => {
            if (!cb.checked) {
              useLocation = false
              status.textContent = ''
              submit.setAttribute('disabled', 'true')
              return
            }
            status.textContent = 'Requesting your location…'
            submit.setAttribute('disabled', 'true')
            void Promise.resolve(this.handlers.onShareLocation()).then((ok) => {
              useLocation = ok
              cb.checked = ok
              if (ok) submit.removeAttribute('disabled')
              else submit.setAttribute('disabled', 'true')
              status.textContent = ok
                ? 'Location shared ✓'
                : 'Couldn’t access your location, allow location access to continue.'
            })
          },
        },
      })
      // Continue stays disabled until the user opts in and we actually capture a
      // location fix — this method can't run without coordinates.
      submit.setAttribute('disabled', 'true')
      this.body.appendChild(
        this.dom.h('label', { class: 'arkyc-addr-opt' }, [
          cb,
          this.dom.h('span', { text: 'Allow access to my current location to confirm my address' }),
        ]),
      )
      this.body.appendChild(status)
    }

    this.footer.appendChild(submit)
  }

  private button(label: string, onClick: () => void, extraClass?: string): HTMLButtonElement {
    const cls = extraClass ? `arkyc-btn ${extraClass}` : 'arkyc-btn'
    const btn = this.dom.h('button', { class: cls, text: label }) as HTMLButtonElement
    // Guard against accidental double-clicks: a button fires once, then disables
    // and shows an inline loader while its (usually async) handler runs. The next
    // screen re-renders a fresh button, so this only spans the in-flight gap.
    let fired = false
    btn.addEventListener('click', () => {
      if (fired) return
      fired = true
      btn.setAttribute('disabled', 'true')
      btn.classList.add('arkyc-busy')
      onClick()
    })
    return btn
  }

  private clear(node: HTMLElement): void {
    while (node.firstChild) node.removeChild(node.firstChild)
  }
}
