import type { FaceMatchResultData } from '@arkyc/types'
import {
  ALIGNED_SIZE,
  FaceDetector,
  ModelStore,
  OnnxModel,
  alignFace,
  decodeImage,
  toTensor,
  type DetectedFace,
} from '@arkyc/vision'
import type { FaceEmbedding, FaceMatchConfig, FaceMatchDriver, FaceMatchRequest } from '../types'

/** Cosine similarity at which SFace embeddings are the same person (OpenCV's calibrated value). */
const SFACE_MATCH = 0.363
const MODEL = 'sface-2021dec'

/**
 * Face matching in-process with open models: YuNet finds and aligns the face,
 * SFace embeds it, and the two embeddings are compared by cosine similarity.
 * The similarity is mapped to a score where the match threshold sits at 0.6.
 */
export class LocalFaceMatchDriver implements FaceMatchDriver {
  readonly name = 'local'

  private loaded?: Promise<{ detector: FaceDetector; recognizer: OnnxModel }>
  private readonly store: ModelStore

  constructor(config: FaceMatchConfig) {
    if (!config.modelDirectory) throw new Error('LocalFaceMatchDriver requires config.modelDirectory')
    this.store = new ModelStore(config.modelDirectory)
  }

  async compare(request: FaceMatchRequest): Promise<FaceMatchResultData> {
    const [portrait, selfie] = await Promise.all([this.embed(request.documentPortrait), this.embed(request.selfie)])
    if (!portrait || !selfie) {
      return {
        passed: false,
        similarityScore: 0,
        confidence: 0,
        raw: { provider: 'local', model: MODEL, faceFound: { portrait: !!portrait, selfie: !!selfie } },
      }
    }

    const cosine = portrait.vector.reduce((sum, value, i) => sum + value * selfie.vector[i]!, 0)

    return {
      passed: cosine >= SFACE_MATCH,
      similarityScore: clamp01(0.6 + (cosine - SFACE_MATCH) * 1.5),
      confidence: Math.min(portrait.detection, selfie.detection),
      raw: { provider: 'local', model: MODEL, cosine },
    }
  }

  async embed(image: Uint8Array): Promise<(FaceEmbedding & { detection: number }) | null> {
    if (!image.length) return null

    const { detector, recognizer } = await this.models()
    const decoded = await decodeImage(image)
    const face = largest(await detector.detect(decoded))
    if (!face) return null

    const aligned = alignFace(decoded, face)
    const output = Object.values(await recognizer.run(toTensor(aligned, 'rgb'), [1, 3, ALIGNED_SIZE, ALIGNED_SIZE]))[0]!
    const norm = Math.hypot(...output) || 1

    return {
      vector: Array.from(output, (value) => value / norm),
      model: MODEL,
      matchThreshold: SFACE_MATCH,
      detection: face.score,
    }
  }

  private models() {
    this.loaded ??= (async () => ({
      detector: await FaceDetector.load(this.store.path('yunet')),
      recognizer: await OnnxModel.load(this.store.path('sface')),
    }))()

    return this.loaded
  }
}

/** The face with the largest box. */
export function largest(faces: DetectedFace[]): DetectedFace | null {
  return faces.reduce<DetectedFace | null>(
    (best, face) => (!best || face.box[2] * face.box[3] > best.box[2] * best.box[3] ? face : best),
    null,
  )
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))
