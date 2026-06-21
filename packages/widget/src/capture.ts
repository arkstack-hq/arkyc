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
