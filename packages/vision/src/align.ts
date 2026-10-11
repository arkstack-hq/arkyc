import type { DetectedFace } from './detector'
import { type Affine, type RgbImage, warpAffine } from './image'

/** Where the five landmarks sit in a 112x112 aligned face (the ArcFace template). */
const TEMPLATE: Array<[number, number]> = [
  [38.2946, 51.6963],
  [73.5318, 51.5014],
  [56.0252, 71.7366],
  [41.5493, 92.3655],
  [70.7299, 92.2041],
]

export const ALIGNED_SIZE = 112

/**
 * The least-squares similarity transform (rotation, uniform scale, translation)
 * taking `from` onto `to`.
 *
 * @param from
 * @param to
 * @returns
 */
export function similarityTransform(from: Array<[number, number]>, to: Array<[number, number]>): Affine {
  const n = from.length
  const mean = (points: Array<[number, number]>) =>
    points.reduce(([sx, sy], [x, y]) => [sx + x / n, sy + y / n], [0, 0] as [number, number])
  const [fx, fy] = mean(from)
  const [tx, ty] = mean(to)

  let dot = 0
  let cross = 0
  let norm = 0
  for (let i = 0; i < n; i += 1) {
    const x = from[i]![0] - fx
    const y = from[i]![1] - fy
    const u = to[i]![0] - tx
    const v = to[i]![1] - ty
    dot += x * u + y * v
    cross += x * v - y * u
    norm += x * x + y * y
  }

  const a = dot / norm
  const b = cross / norm

  return [a, -b, tx - (a * fx - b * fy), b, a, ty - (b * fx + a * fy)]
}

/**
 * Warp a detected face onto the 112x112 template face recognizers expect.
 *
 * @param image
 * @param face
 * @returns
 */
export function alignFace(image: RgbImage, face: DetectedFace): RgbImage {
  return warpAffine(image, similarityTransform(face.landmarks, TEMPLATE), ALIGNED_SIZE, ALIGNED_SIZE)
}
