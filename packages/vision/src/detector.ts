import { type RgbImage, toTensor, warpAffine } from './image'
import { OnnxModel } from './onnx'

/** A detected face in source image pixels. */
export interface DetectedFace {
  /** `[x, y, width, height]`. */
  box: [number, number, number, number]
  /** Right eye, left eye, nose tip, right and left mouth corners. */
  landmarks: Array<[number, number]>
  score: number
}

export interface DetectorOptions {
  /** Minimum detection score in [0, 1]. */
  scoreThreshold?: number
  /** Overlap above which the weaker of two boxes is dropped. */
  nmsThreshold?: number
}

const INPUT_SIZE = 640
const STRIDES = [8, 16, 32]

/** Face detection with YuNet (OpenCV Zoo, MIT). */
export class FaceDetector {
  private constructor(
    private readonly model: OnnxModel,
    private readonly options: Required<DetectorOptions>,
  ) {}

  static async load(path: string, options: DetectorOptions = {}): Promise<FaceDetector> {
    return new FaceDetector(await OnnxModel.load(path), {
      scoreThreshold: options.scoreThreshold ?? 0.6,
      nmsThreshold: options.nmsThreshold ?? 0.3,
    })
  }

  /**
   * Every face in the image, most confident first.
   *
   * @param image
   * @returns
   */
  async detect(image: RgbImage): Promise<DetectedFace[]> {
    const scale = Math.min(INPUT_SIZE / image.width, INPUT_SIZE / image.height)
    const input = warpAffine(image, [scale, 0, 0, 0, scale, 0], INPUT_SIZE, INPUT_SIZE)
    const outputs = await this.model.run(toTensor(input, 'bgr'), [1, 3, INPUT_SIZE, INPUT_SIZE])

    const faces: DetectedFace[] = []
    for (const stride of STRIDES) {
      const cols = INPUT_SIZE / stride
      const cls = outputs[`cls_${stride}`]!
      const obj = outputs[`obj_${stride}`]!
      const bbox = outputs[`bbox_${stride}`]!
      const kps = outputs[`kps_${stride}`]!

      for (let i = 0; i < cls.length; i += 1) {
        const score = Math.sqrt(clamp01(cls[i]!) * clamp01(obj[i]!))
        if (score < this.options.scoreThreshold) continue

        const col = i % cols
        const row = Math.floor(i / cols)
        const cx = (col + bbox[i * 4]!) * stride
        const cy = (row + bbox[i * 4 + 1]!) * stride
        const w = Math.exp(bbox[i * 4 + 2]!) * stride
        const h = Math.exp(bbox[i * 4 + 3]!) * stride
        const landmarks: Array<[number, number]> = []
        for (let k = 0; k < 5; k += 1) {
          landmarks.push([
            ((kps[i * 10 + k * 2]! + col) * stride) / scale,
            ((kps[i * 10 + k * 2 + 1]! + row) * stride) / scale,
          ])
        }

        faces.push({ box: [(cx - w / 2) / scale, (cy - h / 2) / scale, w / scale, h / scale], landmarks, score })
      }
    }

    return this.suppress(faces.sort((a, b) => b.score - a.score))
  }

  private suppress(faces: DetectedFace[]): DetectedFace[] {
    const kept: DetectedFace[] = []
    for (const face of faces) {
      if (kept.every((other) => iou(face.box, other.box) <= this.options.nmsThreshold)) kept.push(face)
    }

    return kept
  }
}

function iou(a: DetectedFace['box'], b: DetectedFace['box']): number {
  const x1 = Math.max(a[0], b[0])
  const y1 = Math.max(a[1], b[1])
  const x2 = Math.min(a[0] + a[2], b[0] + b[2])
  const y2 = Math.min(a[1] + a[3], b[1] + b[3])
  const overlap = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)

  return overlap / (a[2] * a[3] + b[2] * b[3] - overlap)
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))
