import type { DocumentType, LivenessChallenge, VerificationDecision, WidgetStep } from '@arkyc/types'

import { Camera } from './capture'
import type { Facing } from './capture'
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
  ) {
    this.camera = new Camera(doc, nav)
    this.analyzer = analyzer
    this.tuning = tuning
    this.root = this.el('div', { class: 'arkyc-root' })

    const style = this.el('style', { text: theme.stylesheet() })
    this.root.appendChild(style)

    const card = this.el('div', { class: 'arkyc-card' })
    const header = this.el('div', { class: 'arkyc-header' })
    if (theme.logoUrl) {
      header.appendChild(this.el('img', { class: 'arkyc-logo', src: theme.logoUrl }))
    } else {
      header.appendChild(this.el('p', { class: 'arkyc-title', text: 'Verify your identity' }))
    }
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

  /** Whether live camera capture is available (drives the active-liveness branch). */
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
        return this.renderCapture('Front of document', 'environment', state.allowSkip)
      case 'back_capture':
        return this.renderCapture('Back of document', 'environment', state.allowSkip)
      case 'selfie_capture':
        return this.renderCapture('Take a selfie', 'user', state.allowSkip, true)
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

  private renderCapture(title: string, facing: Facing, allowSkip?: boolean, selfie = false): void {
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
      this.body.appendChild(video)

      // Live guidance hint (quality for documents, framing for selfies).
      const hint = this.el('p', { class: 'arkyc-p arkyc-hint' }) as HTMLParagraphElement
      this.body.appendChild(hint)

      const onCapture = () => void this.camera.grabFrame(video).then((blob) => this.handlers.onImage(blob))

      void this.camera.start(video, facing).catch(() => {
        // Camera denied/unavailable — fall back to the file input.
        video.classList.add('arkyc-hidden')
        fileInput.click()
      })

      if (selfie) {
        // Pure auto-capture: face detection grabs the frame when the user is
        // framed. The manual button only appears if the detector can't load.
        this.runSelfieAutoCapture(video, hint, onCapture)
      } else {
        this.runDocumentAutoCapture(video, hint)
        // Document auto-capture rides a coarse brightness heuristic, so the
        // manual button stays as a reliable override.
        this.footer.appendChild(this.button('Capture', onCapture))
      }
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

  /** Document capture: brightness/glare heuristic, auto-grab once steady. */
  private runDocumentAutoCapture(video: HTMLVideoElement, hint: HTMLElement): void {
    let goodStreak = 0
    const timer = setInterval(() => {
      const quality = this.camera.sampleQuality(video)
      if (!quality) return
      if (quality.tooDark) {
        hint.textContent = 'Too dark — find better lighting'
        goodStreak = 0
      } else if (quality.glare) {
        hint.textContent = 'Reduce glare on the document'
        goodStreak = 0
      } else {
        hint.textContent = 'Looks good — hold steady'
        goodStreak += 1
      }
      // Auto-capture a steady document after ~1.5s of good quality.
      if (goodStreak >= 5) {
        clearInterval(timer)
        void this.camera.grabFrame(video).then((blob) => this.handlers.onImage(blob))
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
  private runSelfieAutoCapture(video: HTMLVideoElement, hint: HTMLElement, capture: () => void): void {
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
      let streak = 0
      const timer = setInterval(() => {
        const sample = analyzer.analyze(video)
        if (!sample || !sample.present) {
          hint.textContent = 'Position your face in the circle'
          streak = 0
          return
        }
        if (isSelfieReady(sample, this.tuning)) {
          hint.textContent = 'Hold still…'
          streak += 1
        } else {
          hint.textContent = sample.scale <= 0.28 ? 'Move a little closer' : 'Center your face'
          streak = 0
        }
        if (streak >= 4) {
          clearInterval(timer)
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
    this.body.appendChild(video)

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
      index += 1
      if (index >= challenges.length) {
        finish()
        return
      }
      detector = makeChallengeDetector(challenges[index]!, this.tuning)
      showPrompt()
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
          const timer = setInterval(() => {
            if (index >= challenges.length) {
              clearInterval(timer)
              return
            }
            const sample = analyzer.analyze(video)
            if (!sample) return
            if (detector.feed(sample)) {
              showPrompt(true)
              advanceStep()
            }
          }, 160)
          this.timers.push(timer)
        })
      })
      .catch(() => {
        video.classList.add('arkyc-hidden')
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
