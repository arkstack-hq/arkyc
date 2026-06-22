/**
 * In-browser face analysis for selfie auto-capture and active-liveness detection.
 *
 * The real implementation loads MediaPipe's FaceLandmarker (landmarks +
 * blendshapes) lazily from a CDN at runtime — it is NOT bundled, and never
 * touched unless a live camera screen actually asks for it. Everything is
 * feature-detected and wrapped so that on any failure (no WebGL/WASM, offline,
 * a non-browser/test host) `ready()` resolves `false` and callers fall back to
 * the manual flow. The widget's pure, fake-DOM tests therefore never load it.
 */
import type { LivenessChallenge } from '@arkyc/types'

/** A normalized read of the current frame's face. */
export interface FaceSample {
  present: boolean
  /** Face bounding-box centre, normalized 0–1. */
  centerX: number
  centerY: number
  /** Face bounding-box height, normalized 0–1 (proxy for distance). */
  scale: number
  /** Head turn: <0 toward one side, >0 the other (approx, from landmark asymmetry). */
  turn: number
  /** Head pitch proxy: nose-to-eye offset over face height (relative changes matter). */
  pitch: number
  /** Eyes-closed score 0–1 (blendshape). */
  blink: number
  /** Smile score 0–1 (blendshape). */
  smile: number
}

export interface FaceAnalyzer {
  /** Load models. Resolves `false` if unavailable — callers then go manual. */
  ready(): Promise<boolean>
  /** Analyze the current video frame, or `null` if it can't be read. */
  analyze(video: HTMLVideoElement): FaceSample | null
  /** Release resources. */
  close(): void
}

// CDN asset locations. Built at runtime (not string literals) so bundlers leave
// the dynamic import live instead of trying to resolve/inline it.
const TASKS_VERSION = '0.10.20'
const npm = (path: string) => 'https://cdn.jsdelivr.net/npm/' + path
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

// MediaPipe FaceMesh canonical landmark indices.
const NOSE = 1
const LEFT_EYE = 33
const RIGHT_EYE = 263
const LEFT_EDGE = 234
const RIGHT_EDGE = 454
const CHIN = 152

interface Pt {
  x: number
  y: number
}
interface LmResult {
  faceLandmarks: Pt[][]
  faceBlendshapes?: { categories: { categoryName: string; score: number }[] }[]
}

function blend(cats: { categoryName: string; score: number }[] | undefined, name: string): number {
  return cats?.find((c) => c.categoryName === name)?.score ?? 0
}

function now(): number {
  const p = (globalThis as { performance?: { now?: () => number } }).performance
  return p?.now ? p.now() : 0
}

class MediapipeFaceAnalyzer implements FaceAnalyzer {
  private landmarker: { detectForVideo(v: HTMLVideoElement, t: number): LmResult; close(): void } | null = null
  private state: 'idle' | 'loading' | 'ready' | 'failed' = 'idle'
  private loading: Promise<boolean> | null = null

  async ready(): Promise<boolean> {
    if (this.state === 'ready') return true
    if (this.state === 'failed') return false
    if (this.loading) return this.loading
    this.loading = this.load()
    return this.loading
  }

  private async load(): Promise<boolean> {
    this.state = 'loading'
    try {
      if (typeof document === 'undefined') throw new Error('no document')
      // Bail early if WebGL2 isn't available — MediaPipe needs it.
      const probe = document.createElement('canvas')
      if (!probe.getContext('webgl2')) throw new Error('no webgl2')

      const visionUrl = npm(`@mediapipe/tasks-vision@${TASKS_VERSION}/vision_bundle.mjs`)
      const vision = (await import(/* @vite-ignore */ visionUrl)) as {
        FilesetResolver: { forVisionTasks(url: string): Promise<unknown> }
        FaceLandmarker: { createFromOptions(fileset: unknown, opts: unknown): Promise<unknown> }
      }
      const fileset = await vision.FilesetResolver.forVisionTasks(npm(`@mediapipe/tasks-vision@${TASKS_VERSION}/wasm`))
      this.landmarker = (await vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        outputFaceBlendshapes: true,
        runningMode: 'VIDEO',
        numFaces: 1,
      })) as MediapipeFaceAnalyzer['landmarker']
      this.state = 'ready'
      return true
    } catch {
      this.state = 'failed'
      return false
    }
  }

  analyze(video: HTMLVideoElement): FaceSample | null {
    if (this.state !== 'ready' || !this.landmarker || !video.videoWidth) return null
    let res: LmResult
    try {
      res = this.landmarker.detectForVideo(video, now())
    } catch {
      return null
    }
    const lm = res.faceLandmarks?.[0]
    if (!lm || lm.length === 0) {
      return { present: false, centerX: 0.5, centerY: 0.5, scale: 0, turn: 0, pitch: 0, blink: 0, smile: 0 }
    }

    let minX = 1
    let maxX = 0
    let minY = 1
    let maxY = 0
    for (const p of lm) {
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }
    const height = Math.max(1e-3, maxY - minY)

    const nose = lm[NOSE]!
    const leftEye = lm[LEFT_EYE]!
    const rightEye = lm[RIGHT_EYE]!
    const leftEdge = lm[LEFT_EDGE]!
    const rightEdge = lm[RIGHT_EDGE]!
    const chin = lm[CHIN]!

    // Turn: horizontal asymmetry of the nose between the two face edges.
    const dLeft = nose.x - leftEdge.x
    const dRight = rightEdge.x - nose.x
    const turn = (dLeft - dRight) / Math.max(1e-3, dLeft + dRight)

    // Pitch proxy: nose vertical position between the eye line and the chin.
    const eyeY = (leftEye.y + rightEye.y) / 2
    const pitch = (nose.y - eyeY) / Math.max(1e-3, chin.y - eyeY)

    const cats = res.faceBlendshapes?.[0]?.categories
    const blink = Math.max(blend(cats, 'eyeBlinkLeft'), blend(cats, 'eyeBlinkRight'))
    const smile = (blend(cats, 'mouthSmileLeft') + blend(cats, 'mouthSmileRight')) / 2

    return {
      present: true,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
      scale: height,
      turn,
      pitch,
      blink,
      smile,
    }
  }

  close(): void {
    try {
      this.landmarker?.close()
    } catch {
      /* ignore */
    }
    this.landmarker = null
    this.state = 'failed'
  }
}

/** The default (real, MediaPipe-backed) analyzer. */
export function createDefaultFaceAnalyzer(): FaceAnalyzer {
  return new MediapipeFaceAnalyzer()
}

/** A challenge detector: fed frame samples, returns `true` once satisfied. */
export interface ChallengeDetector {
  feed(sample: FaceSample): boolean
}

/**
 * Detection thresholds. These are the knobs to tune against a real camera —
 * use the calibration harness (`playground/calibration.html`) to read live
 * signal values and adjust. All are overridable per-widget via `faceTuning`.
 */
export interface FaceTuning {
  /** |turn| asymmetry needed to count as a head turn. */
  turn: number
  /** Mouth-smile blendshape score needed to count as a smile. */
  smile: number
  /** Eye-blink score above which the eyes count as closed. */
  blinkClosed: number
  /** Eye-blink score below which they count as re-opened. */
  blinkOpen: number
  /** Consecutive frames a condition must hold before it fires. */
  hold: number
  /** Pitch increase (looking down) needed to arm a nod. */
  nodDown: number
  /** Pitch return delta (back up) that completes a nod. */
  nodReturn: number
  /** Face must grow past `baseline * closerFactor` for move-closer. */
  closerFactor: number
  /** Selfie framing tolerances (distance from frame centre / size window). */
  selfieCenterTol: number
  selfieCenterYTol: number
  selfieMinScale: number
  selfieMaxScale: number
}

export const DEFAULT_TUNING: FaceTuning = {
  turn: 0.18,
  smile: 0.5,
  blinkClosed: 0.55,
  blinkOpen: 0.25,
  hold: 3,
  nodDown: 0.06,
  nodReturn: 0.02,
  closerFactor: 1.22,
  selfieCenterTol: 0.2,
  selfieCenterYTol: 0.25,
  selfieMinScale: 0.28,
  selfieMaxScale: 0.85,
}

/** Build a stateful detector for a single active-liveness challenge. */
export function makeChallengeDetector(challenge: LivenessChallenge, t: FaceTuning = DEFAULT_TUNING): ChallengeDetector {
  switch (challenge) {
    case 'blink': {
      let closed = false
      return {
        feed(s) {
          if (!s.present) return false
          if (s.blink > t.blinkClosed) closed = true
          else if (closed && s.blink < t.blinkOpen) return true
          return false
        },
      }
    }
    case 'smile': {
      let n = 0
      return {
        feed(s) {
          n = s.present && s.smile > t.smile ? n + 1 : 0
          return n >= t.hold
        },
      }
    }
    case 'turn_left': {
      let n = 0
      return {
        feed(s) {
          n = s.present && s.turn < -t.turn ? n + 1 : 0
          return n >= t.hold
        },
      }
    }
    case 'turn_right': {
      let n = 0
      return {
        feed(s) {
          n = s.present && s.turn > t.turn ? n + 1 : 0
          return n >= t.hold
        },
      }
    }
    case 'nod': {
      let base: number | null = null
      let dipped = false
      return {
        feed(s) {
          if (!s.present) return false
          if (base === null) {
            base = s.pitch
            return false
          }
          if (s.pitch > base + t.nodDown) dipped = true
          else if (dipped && s.pitch < base + t.nodReturn) return true
          return false
        },
      }
    }
    case 'move_closer': {
      let base: number | null = null
      let n = 0
      return {
        feed(s) {
          if (!s.present) return false
          if (base === null) {
            base = s.scale
            return false
          }
          n = s.scale > base * t.closerFactor ? n + 1 : 0
          return n >= t.hold
        },
      }
    }
  }
}

/** Whether a face is well-framed for a selfie (present, centred, right distance). */
export function isSelfieReady(s: FaceSample, t: FaceTuning = DEFAULT_TUNING): boolean {
  return (
    s.present &&
    Math.abs(s.centerX - 0.5) < t.selfieCenterTol &&
    Math.abs(s.centerY - 0.5) < t.selfieCenterYTol &&
    s.scale > t.selfieMinScale &&
    s.scale < t.selfieMaxScale
  )
}
