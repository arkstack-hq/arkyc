import type { LivenessResultData } from '@arkyc/types'
import {
  FaceDetector,
  ModelStore,
  OnnxModel,
  cropResize,
  decodeImage,
  toTensor,
  type DetectedFace,
} from '@arkyc/vision'
import { challengesMatch } from '../challenges'
import type { LivenessConfig, LivenessDriver, LivenessRequest } from '../types'

const INPUT_SIZE = 80
/** How far beyond the face box MiniFASNetV2 looks, as a multiple of the box. */
const CROP_SCALE = 2.7
/** Output index of the "real face" class. */
const REAL = 1
/**
 * Below this crop scale (the face fills the frame) the model can't judge the face:
 * it reads a crop that tight as a spoof whatever is in front of the camera.
 */
const MIN_JUDGEABLE_CROP = 1.5
/** A second face counts when it is at least this large relative to the main one. */
const SECOND_FACE_RATIO = 0.25

/**
 * Passive liveness in-process with open models: YuNet finds the face and
 * MiniFASNetV2 scores it as a live person or a presentation attack (print,
 * replay). In active mode the challenge sequence must also match the one issued.
 */
export class LocalLivenessDriver implements LivenessDriver {
  readonly name = 'local'

  private loaded?: Promise<{ detector: FaceDetector; antiSpoof: OnnxModel }>
  private readonly store: ModelStore

  constructor(config: LivenessConfig) {
    if (!config.modelDirectory) throw new Error('LocalLivenessDriver requires config.modelDirectory')
    this.store = new ModelStore(config.modelDirectory)
  }

  async check(request: LivenessRequest): Promise<LivenessResultData> {
    const active = request.mode === 'active'
    const sequenceOk = active ? challengesMatch(request.challenges ?? [], request.performedChallenges ?? []) : true

    const { detector, antiSpoof } = await this.models()
    const image = request.selfie.length ? await decodeImage(request.selfie) : null
    const faces = image ? await detector.detect(image) : []
    const face = faces[0]

    if (!image || !face) {
      return this.result(false, 0, { faceNotCentered: true }, { faceFound: false, sequenceOk })
    }

    const region = this.cropRegion(face, image.width, image.height)
    const cropScale = region[3] / face.box[3]
    const faceHeightRatio = round(face.box[3] / image.height)

    if (cropScale < MIN_JUDGEABLE_CROP) {
      // Too close to judge, which is no evidence of a spoof: pass with a zero
      // score so the decision engine sends it to a reviewer (low liveness
      // confidence) instead of declining a real person. A failed challenge
      // sequence still fails.
      return this.result(
        sequenceOk,
        0,
        { faceTooClose: true, screenReplay: active && !sequenceOk },
        { judged: false, faces: faces.length, sequenceOk, faceHeightRatio, cropScale: round(cropScale) },
      )
    }

    const crop = cropResize(image, region, INPUT_SIZE, INPUT_SIZE)
    const logits = Object.values(await antiSpoof.run(toTensor(crop, 'bgr'), [1, 3, INPUT_SIZE, INPUT_SIZE]))[0]!
    const realProbability = softmax(Array.from(logits))[REAL]!

    const area = (f: DetectedFace) => f.box[2] * f.box[3]
    const multipleFaces = faces.slice(1).some((other) => area(other) >= area(face) * SECOND_FACE_RATIO)
    const [cx, cy] = [face.box[0] + face.box[2] / 2, face.box[1] + face.box[3] / 2]
    const faceNotCentered = Math.abs(cx / image.width - 0.5) > 0.3 || Math.abs(cy / image.height - 0.5) > 0.3

    const score = sequenceOk ? realProbability : Math.min(realProbability, 0.3)

    return this.result(
      realProbability >= 0.5 && sequenceOk,
      score,
      {
        screenReplay: realProbability < 0.5 || (active && !sequenceOk),
        multipleFaces,
        faceNotCentered,
      },
      {
        realProbability,
        detection: face.score,
        faces: faces.length,
        sequenceOk,
        // The model expects a crop CROP_SCALE× the face; a face that fills the
        // frame forces a tighter one (cropScale below CROP_SCALE), which it
        // tends to score as a spoof. Kept to diagnose false rejections.
        faceHeightRatio,
        cropScale: round(cropScale),
      },
    )
  }

  /** MiniFASNet's crop: the face box scaled around its centre, kept inside the image. */
  private cropRegion(face: DetectedFace, width: number, height: number): [number, number, number, number] {
    const [x, y, w, h] = face.box
    const scale = Math.min((height - 1) / h, (width - 1) / w, CROP_SCALE)
    const [cw, ch] = [w * scale, h * scale]
    const left = Math.max(0, x + w / 2 - cw / 2)
    const top = Math.max(0, y + h / 2 - ch / 2)

    return [left, top, Math.min(width - 1, left + cw) - left, Math.min(height - 1, top + ch) - top]
  }

  private result(
    passed: boolean,
    score: number,
    signals: LivenessResultData['spoofSignals'],
    raw: Record<string, unknown>,
  ): LivenessResultData {
    return {
      passed,
      score,
      spoofSignals: {
        screenReplay: false,
        printedPhoto: false,
        maskDetected: false,
        multipleFaces: false,
        faceNotCentered: false,
        poorLighting: false,
        ...signals,
      },
      raw: { provider: 'local', model: 'minifasnet-v2', ...raw },
    }
  }

  private models() {
    this.loaded ??= (async () => ({
      detector: await FaceDetector.load(this.store.path('yunet')),
      antiSpoof: await OnnxModel.load(this.store.path('minifasnet')),
    }))()

    return this.loaded
  }
}

function softmax(values: number[]): number[] {
  const max = Math.max(...values)
  const exps = values.map((value) => Math.exp(value - max))
  const sum = exps.reduce((a, b) => a + b, 0)

  return exps.map((value) => value / sum)
}

const round = (value: number) => Math.round(value * 1000) / 1000
