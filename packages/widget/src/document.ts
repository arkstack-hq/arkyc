/**
 * In-browser document detection for the capture screens. Pure JavaScript, no
 * dependency: it draws the current frame to a small canvas and runs Sobel edge
 * projection to locate the document's four borders, then judges whether a real,
 * well-framed, in-focus document is present before auto-capturing.
 *
 * Like the face analyzer it is feature-detected and wrapped so that on any
 * failure (no 2D canvas, a non-browser/test host) `ready()` resolves `false` and
 * the caller falls back to the simpler brightness heuristic. The detection core
 * (`analyzeDocumentGray` / `documentGuidance`) is a set of pure functions over a
 * grayscale buffer, so it is unit-testable without a real canvas or camera.
 */

/** Detected document rectangle, normalized 0–1 within the frame. */
export interface DocRect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * A normalized read of the current frame's document candidate.
 */
export interface DocumentSample {
  /** A plausible rectangular document border was found. */
  present: boolean
  /** The detected border rectangle (normalized 0–1). */
  rect: DocRect
  /** Rectangle area as a fraction of the frame (proxy for distance). */
  fill: number
  centerX: number
  centerY: number
  /** Weakest of the four border edges, 0–1 (how convincingly bordered it is). */
  edgeStrength: number
  /** Variance of the Laplacian over the frame — a focus/blur proxy (higher = sharper). */
  sharpness: number
  /** Mean luminance, 0–1. */
  brightness: number
}

export interface DocumentAnalyzer {
  /** Prepare the canvas. Resolves `false` if unavailable — callers go manual. */
  ready(): Promise<boolean>
  /** Analyze the current video frame, or `null` if it can't be read. */
  analyze(video: HTMLVideoElement): DocumentSample | null
  /** Release resources. */
  close(): void
}

/**
 * Detection thresholds. Tunable per-widget via `documentTuning`. Like the face
 * tuning, the geometric/strength knobs benefit from calibration against real
 * devices and lighting.
 */
export interface DocumentTuning {
  /** Width (px) the frame is downscaled to before analysis. */
  sampleWidth: number
  /** Min / max rectangle area (fraction of frame) — too small = far, too big = cropped. */
  minFill: number
  maxFill: number
  /** Max distance of the document centre from the frame centre (0–1). */
  centerTol: number
  /** Min weakest-border strength to count as a real document edge (0–1). */
  minEdgeStrength: number
  /** Min Laplacian variance to count as in-focus. */
  minSharpness: number
  /** Each border must sit at least this far (0–1) inside the frame (not cropped). */
  borderMargin: number
  /** Below this mean luminance the frame is treated as too dark. */
  minBrightness: number
  /** Consecutive "ready" frames before auto-capture fires. */
  hold: number
}

export const DEFAULT_DOCUMENT_TUNING: DocumentTuning = {
  sampleWidth: 320,
  minFill: 0.28,
  maxFill: 0.97,
  centerTol: 0.2,
  minEdgeStrength: 0.1,
  minSharpness: 8,
  borderMargin: 0.012,
  minBrightness: 0.18,
  hold: 5,
}

/**
 * The four border insets of a rect from the frame edges (top, right, bottom, left).
 *
 * @param rect
 * @returns
 */
function margins(rect: DocRect): [number, number, number, number] {
  return [rect.y, 1 - (rect.x + rect.w), 1 - (rect.y + rect.h), rect.x]
}

function peak(arr: Float64Array, lo: number, hi: number): { i: number; v: number } {
  let bi = lo
  let bv = -1
  for (let i = lo; i < hi; i += 1) {
    const v = arr[i]!
    if (v > bv) {
      bv = v
      bi = i
    }
  }
  return { i: bi, v: bv }
}

/**
 * Locate the dominant rectangle in a grayscale frame via Sobel edge projection,
 * and measure focus and brightness. Pure — operates on a grayscale buffer.
 *
 * @param tuning
 * @returns
 */
export function analyzeDocumentGray(gray: ArrayLike<number>, w: number, h: number): DocumentSample {
  const empty: DocumentSample = {
    present: false,
    rect: { x: 0, y: 0, w: 0, h: 0 },
    fill: 0,
    centerX: 0.5,
    centerY: 0.5,
    edgeStrength: 0,
    sharpness: 0,
    brightness: 0,
  }
  if (w < 8 || h < 8 || gray.length < w * h) return empty

  // Per-row horizontal-edge energy (|gy|) and per-column vertical-edge energy (|gx|).
  const rowH = new Float64Array(h)
  const colV = new Float64Array(w)
  let lapSum = 0
  let lapSumSq = 0
  let lapN = 0
  let lumSum = 0
  for (let i = 0; i < w * h; i += 1) lumSum += gray[i]!
  const brightness = lumSum / (w * h * 255)

  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x
      const tl = gray[i - w - 1]!
      const tc = gray[i - w]!
      const tr = gray[i - w + 1]!
      const ml = gray[i - 1]!
      const c = gray[i]!
      const mr = gray[i + 1]!
      const bl = gray[i + w - 1]!
      const bc = gray[i + w]!
      const br = gray[i + w + 1]!
      const gx = tr + 2 * mr + br - (tl + 2 * ml + bl)
      const gy = bl + 2 * bc + br - (tl + 2 * tc + tr)
      rowH[y]! += Math.abs(gy)
      colV[x]! += Math.abs(gx)
      const lap = 4 * c - ml - mr - tc - bc
      lapSum += lap
      lapSumSq += lap * lap
      lapN += 1
    }
  }
  const sharpness = lapN ? lapSumSq / lapN - (lapSum / lapN) ** 2 : 0

  const bandH = Math.max(1, Math.floor(h * 0.05))
  const bandW = Math.max(1, Math.floor(w * 0.05))
  const midY = Math.floor(h / 2)
  const midX = Math.floor(w / 2)

  // Top/bottom borders are the strongest horizontal edges in the upper/lower half;
  // left/right borders the strongest vertical edges in the left/right half.
  const top = peak(rowH, bandH, midY)
  const bottom = peak(rowH, midY, h - bandH)
  const left = peak(colV, bandW, midX)
  const right = peak(colV, midX, w - bandW)

  const x0 = left.i / w
  const x1 = right.i / w
  const y0 = top.i / h
  const y1 = bottom.i / h
  const rect: DocRect = { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) }

  // Normalize each border by its own length (max |sobel| ≈ 4·255), so strength
  // measures how cleanly bordered the edge is, independent of document size —
  // size is judged separately by `fill`.
  const topLenPx = Math.max(1, rect.w * w)
  const sideLenPx = Math.max(1, rect.h * h)
  const edgeStrength = Math.min(
    top.v / (topLenPx * 1020),
    bottom.v / (topLenPx * 1020),
    left.v / (sideLenPx * 1020),
    right.v / (sideLenPx * 1020),
  )
  const present = rect.w > 0.12 && rect.h > 0.12 && edgeStrength > 0.04

  return {
    present,
    rect,
    fill: rect.w * rect.h,
    centerX: (x0 + x1) / 2,
    centerY: (y0 + y1) / 2,
    edgeStrength,
    sharpness,
    brightness,
  }
}

/**
 * Whether a document is present, well-framed and in focus, with a guidance hint.
 *
 * @param tuning
 * @returns
 */
export function documentGuidance(
  s: DocumentSample,
  t: DocumentTuning = DEFAULT_DOCUMENT_TUNING,
): { ready: boolean; hint: string } {
  if (s.brightness < t.minBrightness) return { ready: false, hint: 'Too dark — find better lighting' }
  if (!s.present || s.edgeStrength < t.minEdgeStrength) {
    return { ready: false, hint: 'Fit your document inside the frame' }
  }
  if (s.fill > t.maxFill || Math.min(...margins(s.rect)) < t.borderMargin) {
    return { ready: false, hint: 'Move back a little — fit the whole document' }
  }
  if (s.fill < t.minFill) return { ready: false, hint: 'Move closer' }
  if (Math.abs(s.centerX - 0.5) > t.centerTol || Math.abs(s.centerY - 0.5) > t.centerTol) {
    return { ready: false, hint: 'Center the document' }
  }
  if (s.sharpness < t.minSharpness) return { ready: false, hint: 'Hold steady to focus' }
  return { ready: true, hint: 'Looks good — hold steady' }
}

/**
 * Whether the sample is a well-framed, in-focus document ready to capture.
 *
 * @param s
 * @param t
 * @returns
 */
export function isDocumentReady(s: DocumentSample, t: DocumentTuning = DEFAULT_DOCUMENT_TUNING): boolean {
  return documentGuidance(s, t).ready
}

class CanvasDocumentAnalyzer implements DocumentAnalyzer {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null

  constructor(private readonly tuning: DocumentTuning) { }

  ready(): Promise<boolean> {
    try {
      if (typeof document === 'undefined') return Promise.resolve(false)
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return Promise.resolve(false)
      this.canvas = canvas
      this.ctx = ctx
      return Promise.resolve(true)
    } catch {
      return Promise.resolve(false)
    }
  }

  analyze(video: HTMLVideoElement): DocumentSample | null {
    if (!this.ctx || !this.canvas || !video.videoWidth) return null
    const tw = this.tuning.sampleWidth
    const th = Math.max(1, Math.round((tw * video.videoHeight) / video.videoWidth))
    this.canvas.width = tw
    this.canvas.height = th
    let data: Uint8ClampedArray
    try {
      this.ctx.drawImage(video, 0, 0, tw, th)
      data = this.ctx.getImageData(0, 0, tw, th).data
    } catch {
      return null
    }
    const gray = new Float32Array(tw * th)
    for (let i = 0, p = 0; i < gray.length; i += 1, p += 4) {
      gray[i] = 0.299 * data[p]! + 0.587 * data[p + 1]! + 0.114 * data[p + 2]!
    }
    return analyzeDocumentGray(gray, tw, th)
  }

  close(): void {
    this.canvas = null
    this.ctx = null
  }
}

/**
 * The default (canvas edge-projection) document analyzer.
 *
 * @param tuning
 * @returns
 */
export function createDefaultDocumentAnalyzer(tuning: DocumentTuning = DEFAULT_DOCUMENT_TUNING): DocumentAnalyzer {
  return new CanvasDocumentAnalyzer(tuning)
}
