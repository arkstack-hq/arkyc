/**
 * Camera capture, scoped to one class. DOM-injectable so the widget core stays
 * testable without a real browser. A live `getUserMedia` preview is used when
 * available; the view always offers a file input as a fallback. An instance
 * owns the active stream so callers don't track it themselves.
 */

/** Which camera to request: `environment` for documents, `user` for selfies. */
export type Facing = 'environment' | 'user'

export class Camera {
  private stream: MediaStream | null = null

  constructor(
    private readonly doc: Document = globalThis.document,
    private readonly nav: Navigator = globalThis.navigator,
  ) {}

  /** Whether live camera capture is available in this environment. */
  get supported(): boolean {
    return !!this.nav?.mediaDevices?.getUserMedia
  }

  /**
   * Start a camera stream and bind it to a `<video>` element for preview.
   *
   * @param video
   * @param facing
   * @returns
   */
  async start(video: HTMLVideoElement, facing: Facing): Promise<MediaStream> {
    const stream = await this.nav.mediaDevices.getUserMedia({
      video: { facingMode: facing },
      audio: false,
    })
    this.stream = stream
    video.srcObject = stream
    video.setAttribute('playsinline', 'true')
    video.muted = true
    await video.play().catch(() => undefined)
    return stream
  }

  /**
   * Stop the active stream and release the camera.
   */
  stop(): void {
    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null
  }

  /** Whether this environment can record video (active liveness). */
  get canRecord(): boolean {
    return typeof (globalThis as { MediaRecorder?: unknown }).MediaRecorder !== 'undefined'
  }

  /**
   * Start recording the active stream. Returns a handle whose `stop()` resolves
   * to the recorded `video/webm` blob — used by the active-liveness flow to record
   * the user performing the challenge sequence.
   *
   * @param stream
   * @returns
   */
  recordStart(stream: MediaStream): { stop(): Promise<Blob> } {
    const chunks: BlobPart[] = []
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' })
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data)
    }
    recorder.start()

    return {
      stop: () =>
        new Promise<Blob>((resolve) => {
          recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }))
          recorder.stop()
        }),
    }
  }

  /**
   * Sample the current frame's average luminance for basic quality hints (too
   * dark / glare). A cheap proxy with no model — enough to guide the user and
   * gate auto-capture.
   *
   * @param video
   * @returns A 0–1 brightness plus `tooDark`/`glare` flags, or `null` if unreadable.
   */
  sampleQuality(video: HTMLVideoElement): { brightness: number; tooDark: boolean; glare: boolean } | null {
    const canvas = this.doc.createElement('canvas')
    // Downscale heavily — we only need an average, not detail.
    canvas.width = 32
    canvas.height = 32
    const ctx = canvas.getContext('2d')
    if (!ctx || !video.videoWidth) return null
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    let sum = 0
    let bright = 0
    const pixels = data.length / 4
    for (let i = 0; i < data.length; i += 4) {
      const lum = (0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!) / 255
      sum += lum
      if (lum > 0.92) bright += 1
    }
    const brightness = sum / pixels
    return { brightness, tooDark: brightness < 0.25, glare: bright / pixels > 0.15 }
  }

  /**
   * Grab the current video frame as a JPEG `Blob` via an offscreen canvas.
   *
   * @param video
   * @param quality
   * @returns
   */
  grabFrame(video: HTMLVideoElement, quality = 0.92): Promise<Blob> {
    const canvas = this.doc.createElement('canvas')
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext('2d')
    if (!ctx) return Promise.reject(new Error('Canvas 2D context unavailable.'))
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Failed to capture frame.'))),
        'image/jpeg',
        quality,
      )
    })
  }

  /**
   * Read a selected file from an `<input type="file">` as a `Blob`.
   *
   * @param input
   * @returns
   */
  static fileFromInput(input: HTMLInputElement): Blob | null {
    return input.files?.[0] ?? null
  }
}
