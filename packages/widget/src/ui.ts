import type { DocumentType, LivenessChallenge, VerificationDecision, WidgetStep } from '@arkyc/types'

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

/** High-level events the view raises back to the controller. */
export interface ViewHandlers {
  onClose(): void
  onStart(): void
  onDocumentSelected(type: DocumentType, country: string): void
  /** A capture screen produced an image (or `null` when skipped in demo mode). */
  onImage(blob: Blob | null): void
  /** Active liveness finished: the recorded video (or `null`) + the performed sequence. */
  onActiveLiveness(video: Blob | null, performed: LivenessChallenge[]): void
  /** The result screen was acknowledged ("Done"). */
  onAcknowledge(): void
}

/** Per-render data the view needs for the current step. */
export interface ViewState {
  step: WidgetStep
  documentType: DocumentType | null
  decision?: VerificationDecision | null
  statusLabel?: string
  errorMessage?: string
  /** Show a "Skip" affordance on capture screens (demo / mock-driver flows). */
  allowSkip?: boolean
  /** The challenge sequence to prompt for the active-liveness screen. */
  livenessChallenges?: LivenessChallenge[]
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
  /** Snap the bracket frame onto a detected document (or reset with `null`). */
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

interface ElProps {
  class?: string
  text?: string
  html?: string
  type?: string
  src?: string
  accept?: string
  placeholder?: string
  value?: string
  [attr: string]: string | undefined
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
  private readonly camera: Camera
  private readonly analyzer: FaceAnalyzer | null
  private readonly tuning: FaceTuning
  private readonly docAnalyzer: DocumentAnalyzer | null
  private readonly docTuning: DocumentTuning
  /** Interval ids for live quality/recording timers, cleared on re-render. */
  private timers: ReturnType<typeof setInterval>[] = []
  /** Extra teardown run on each re-render (cancels in-flight detection loops). */
  private cleanups: (() => void)[] = []

  constructor(
    private readonly doc: Document,
    private readonly theme: Theme,
    private readonly handlers: ViewHandlers,
    nav: Navigator = globalThis.navigator,
    analyzer: FaceAnalyzer | null = createDefaultFaceAnalyzer(),
    tuning: FaceTuning = DEFAULT_TUNING,
    docAnalyzer: DocumentAnalyzer | null = createDefaultDocumentAnalyzer(),
    docTuning: DocumentTuning = DEFAULT_DOCUMENT_TUNING,
  ) {
    this.camera = new Camera(doc, nav)
    this.analyzer = analyzer
    this.tuning = tuning
    this.docAnalyzer = docAnalyzer
    this.docTuning = docTuning
    this.root = this.el('div', { class: 'arkyc-root' })

    const style = this.el('style', { text: theme.stylesheet() })
    this.root.appendChild(style)

    const card = this.el('div', { class: 'arkyc-card' })
    const header = this.el('div', { class: 'arkyc-header' })
    // Project branding: show the logo and/or name when allowed; otherwise a
    // neutral title. The "brand" group keeps a logo and name side by side.
    const brand = this.el('div', { class: 'arkyc-brand' })
    if (theme.showBranding && (theme.logoUrl || theme.name)) {
      if (theme.logoUrl) brand.appendChild(this.el('img', { class: 'arkyc-logo', src: theme.logoUrl }))
      if (theme.name) brand.appendChild(this.el('span', { class: 'arkyc-brand-name', text: theme.name }))
    } else {
      brand.appendChild(this.el('p', { class: 'arkyc-title', text: 'Verify your identity' }))
    }
    header.appendChild(brand)
    const close = this.el('button', {
      class: 'arkyc-close',
      html: '&times;',
      'aria-label': 'Close',
    })
    close.addEventListener('click', () => this.handlers.onClose())
    header.appendChild(close)

    this.body = this.el('div', { class: 'arkyc-body' })
    this.footer = this.el('div', { class: 'arkyc-footer' })

    card.appendChild(header)
    card.appendChild(this.body)
    card.appendChild(this.footer)
    this.root.appendChild(card)
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

    switch (state.step) {
      case 'welcome':
        return this.renderWelcome()
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
      case 'passive_liveness':
        return this.renderProcessing('Checking liveness…')
      case 'face_match':
        return this.renderProcessing('Matching your face…')
      case 'processing':
        return this.renderProcessing(state.statusLabel ?? 'Finalising verification…')
      case 'result':
        return this.renderResult(state.decision ?? null, state.errorMessage)
    }
  }

  private renderWelcome(): void {
    this.body.appendChild(this.el('h2', { class: 'arkyc-h', text: 'Verify your identity' }))
    this.body.appendChild(
      this.el('p', {
        class: 'arkyc-p',
        text: 'You will need a government-issued ID and a moment to take a selfie. Your data is processed securely.',
      }),
    )
    this.footer.appendChild(this.button('Get started', () => this.handlers.onStart()))
  }

  private renderDocumentSelection(): void {
    this.body.appendChild(this.el('h2', { class: 'arkyc-h', text: 'Select your document' }))
    const country = this.el('input', {
      class: 'arkyc-btn arkyc-btn-ghost',
      placeholder: 'Country code (e.g. US)',
      'aria-label': 'Country code',
    }) as HTMLInputElement
    this.body.appendChild(country)

    const choices = this.el('div', { class: 'arkyc-choices' })
    ;(Object.keys(DOCUMENT_LABELS) as DocumentType[]).forEach((type) => {
      const btn = this.button(DOCUMENT_LABELS[type], () =>
        this.handlers.onDocumentSelected(type, (country.value || '').trim().toUpperCase()),
      )
      btn.classList.add('arkyc-btn-ghost')
      choices.appendChild(btn)
    })
    this.body.appendChild(choices)
  }

  private renderCapture(title: string, facing: Facing, allowSkip?: boolean, selfie = false, strict = false): void {
    // Documents in the active flow are strict: detection-gated only (no manual
    // bypass). Selfies are always pure auto, so strictness only changes documents.
    const strictDoc = strict && !selfie
    this.body.appendChild(this.el('h2', { class: 'arkyc-h', text: title }))
    this.body.appendChild(this.el('p', { class: 'arkyc-p', text: 'Position it clearly in frame, then capture.' }))

    const fileInput = this.el('input', {
      type: 'file',
      accept: 'image/*',
      class: 'arkyc-hidden',
    }) as HTMLInputElement
    fileInput.addEventListener('change', () => this.handlers.onImage(Camera.fileFromInput(fileInput)))
    this.body.appendChild(fileInput)

    if (this.camera.supported) {
      const video = this.el('video', {
        class: `arkyc-preview${selfie ? ' selfie' : ''}`,
      }) as HTMLVideoElement

      // Wrap the preview in its animated overlay (circular ring for selfies,
      // bracket frame for documents).
      const face = selfie ? this.buildFaceStage(video) : null
      const doc = selfie ? null : this.buildDocStage(video)
      const mount = face?.stage ?? doc!.stage
      this.body.appendChild(mount)

      // Live guidance hint (quality for documents, framing for selfies).
      const hint = this.el('p', { class: 'arkyc-p arkyc-hint' }) as HTMLParagraphElement
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
          const still = this.el('img', {
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
      this.body.appendChild(this.el('div', { class: 'arkyc-badge err', html: '!' }))
      this.body.appendChild(
        this.el('p', {
          class: 'arkyc-p',
          text: 'This step needs a working camera to scan your document. Please retry on a device with a camera.',
        }),
      )
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
    this.cleanups.push(() => {
      cancelled = true
    })
    void analyzer.ready().then((ok) => {
      if (cancelled) return
      if (!ok) {
        onNoDetector()
        return
      }
      let goodStreak = 0
      const timer = setInterval(() => {
        const sample = analyzer.analyze(video)
        if (!sample) return
        const { ready, hint: message } = documentGuidance(sample, this.docTuning)
        hint.textContent = message
        doc.setFrame(sample.present ? sample.rect : null)
        doc.setQuality(ready ? 'good' : sample.present ? 'wait' : 'bad')
        goodStreak = ready ? goodStreak + 1 : 0
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
    this.cleanups.push(() => {
      cancelled = true
    })
    void analyzer.ready().then((ok) => {
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
    this.body.appendChild(this.el('h2', { class: 'arkyc-h', text: 'Liveness check' }))
    const prompt = this.el('p', {
      class: 'arkyc-p',
      text: 'Follow the on-screen prompts. Keep your face centred in the circle.',
    })
    this.body.appendChild(prompt)

    const fileFallback = !this.camera.supported || !this.camera.canRecord

    if (fileFallback) {
      if (requireLiveCamera) {
        // capture_model = active: a live camera is mandatory. Do NOT offer a
        // manual "I did it" path — surface the device as unsupported instead.
        this.body.appendChild(this.el('div', { class: 'arkyc-badge err', html: '!' }))
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

    const video = this.el('video', { class: 'arkyc-preview selfie' }) as HTMLVideoElement
    const face = this.buildFaceStage(video)
    const dots = this.buildDots(challenges.length)
    if (challenges.length > 1) this.body.appendChild(dots.el)
    this.body.appendChild(face.stage)

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
      void Promise.resolve(recording?.stop() ?? Promise.resolve(null)).then((blob) =>
        this.handlers.onActiveLiveness(blob, performed),
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
    const stage = this.el('div', { class: 'arkyc-stage' })
    stage.setAttribute('data-state', 'wait')
    stage.appendChild(video)

    const ring = this.el('div', {
      class: 'arkyc-ring',
      html: '<svg viewBox="0 0 100 100"><circle class="arkyc-ring-track" cx="50" cy="50" r="46"/><circle class="arkyc-ring-arc" cx="50" cy="50" r="46"/></svg>',
    })
    stage.appendChild(ring)
    const cue = this.el('div', { class: 'arkyc-cue' })
    stage.appendChild(cue)
    stage.appendChild(this.el('div', { class: 'arkyc-check', html: CHECK_ICON }))

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
    const el = this.el('div', { class: 'arkyc-dots' })
    const dots: HTMLElement[] = []
    for (let i = 0; i < count; i += 1) {
      const dot = this.el('div', { class: 'arkyc-dot' })
      dots.push(dot)
      el.appendChild(dot)
    }
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
   * Build the document preview overlay: corner brackets + an animated scan line.
   *
   * @param video
   * @returns
   */
  private buildDocStage(video: HTMLVideoElement): DocStage {
    const stage = this.el('div', { class: 'arkyc-doc' })
    stage.setAttribute('data-q', 'wait')
    stage.appendChild(video)
    const frame = this.el('div', { class: 'arkyc-doc-frame' })
    for (const corner of ['tl', 'tr', 'bl', 'br']) {
      frame.appendChild(this.el('span', { class: `arkyc-corner ${corner}` }))
    }
    stage.appendChild(frame)
    stage.appendChild(this.el('div', { class: 'arkyc-scan' }))
    return {
      stage,
      setQuality: (quality) => stage.setAttribute('data-q', quality),
      setFrame: (rect) => {
        if (!rect) {
          // Reset to the default CSS inset guide.
          frame.style.inset = ''
          frame.style.left = frame.style.top = frame.style.width = frame.style.height = ''
          return
        }
        frame.style.inset = 'auto'
        frame.style.left = `${rect.x * 100}%`
        frame.style.top = `${rect.y * 100}%`
        frame.style.width = `${rect.w * 100}%`
        frame.style.height = `${rect.h * 100}%`
      },
    }
  }

  private renderProcessing(label: string): void {
    this.body.appendChild(this.el('div', { class: 'arkyc-spinner' }))
    this.body.appendChild(this.el('p', { class: 'arkyc-p', text: label }))
  }

  private renderResult(decision: VerificationDecision | null, errorMessage?: string): void {
    if (errorMessage) {
      this.body.appendChild(this.el('div', { class: 'arkyc-badge err', html: '!' }))
      this.body.appendChild(this.el('h2', { class: 'arkyc-h', text: 'Something went wrong' }))
      this.body.appendChild(this.el('p', { class: 'arkyc-p', text: errorMessage }))
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
      this.body.appendChild(this.el('div', { class: `arkyc-badge ${r.cls}`, text: r.icon }))
      this.body.appendChild(this.el('h2', { class: 'arkyc-h', text: r.title }))
      this.body.appendChild(this.el('p', { class: 'arkyc-p', text: r.copy }))
    }
    this.footer.appendChild(this.button('Done', () => this.handlers.onAcknowledge()))
  }

  private button(label: string, onClick: () => void): HTMLButtonElement {
    const btn = this.el('button', { class: 'arkyc-btn', text: label }) as HTMLButtonElement
    btn.addEventListener('click', onClick)
    return btn
  }

  private clear(node: HTMLElement): void {
    while (node.firstChild) node.removeChild(node.firstChild)
  }

  private el<T extends HTMLElement = HTMLElement>(tag: string, props: ElProps = {}): T {
    const node = this.doc.createElement(tag) as T
    for (const [key, value] of Object.entries(props)) {
      if (value == null) continue
      if (key === 'class') node.className = value
      else if (key === 'text') node.textContent = value
      else if (key === 'html') node.innerHTML = value
      else if (key === 'value' || key === 'src' || key === 'type' || key === 'accept' || key === 'placeholder') {
        ;(node as unknown as Record<string, string>)[key] = value
      } else node.setAttribute(key, value)
    }
    return node
  }
}
