/** A decoded 8-bit RGB image, row-major and interleaved. */
export interface RgbImage {
  data: Uint8Array
  width: number
  height: number
}

/** A 2x3 affine matrix `[a, b, tx, c, d, ty]` mapping source to destination. */
export type Affine = [number, number, number, number, number, number]

/**
 * Decode any image format sharp reads into RGB, honouring EXIF orientation.
 *
 * @param bytes
 * @returns
 */
export async function decodeImage(bytes: Uint8Array): Promise<RgbImage> {
  const sharp = (await import('sharp').catch(() => {
    throw new Error('Local biometrics need the `sharp` package installed')
  })) as unknown as { default: (input: Uint8Array) => SharpLike }
  const { data, info } = await sharp
    .default(bytes)
    .rotate()
    .removeAlpha()
    .toColourspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true })

  return { data: new Uint8Array(data.buffer, data.byteOffset, data.length), width: info.width, height: info.height }
}

interface SharpLike {
  rotate(): SharpLike
  removeAlpha(): SharpLike
  toColourspace(space: string): SharpLike
  raw(): SharpLike
  toBuffer(options: { resolveWithObject: true }): Promise<{ data: Buffer; info: { width: number; height: number } }>
}

/** Bilinear sample of channel `c` at a fractional position; outside the image reads as black. */
function sample(image: RgbImage, x: number, y: number, c: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const at = (px: number, py: number) =>
    px < 0 || py < 0 || px >= image.width || py >= image.height ? 0 : image.data[(py * image.width + px) * 3 + c]!

  const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx
  const bottom = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx

  return top * (1 - fy) + bottom * fy
}

/**
 * Warp an image by an affine transform into a `width` x `height` output.
 *
 * @param image
 * @param matrix Maps source coordinates to output coordinates.
 * @param width
 * @param height
 * @returns
 */
export function warpAffine(image: RgbImage, matrix: Affine, width: number, height: number): RgbImage {
  const [a, b, tx, c, d, ty] = matrix
  const det = a * d - b * c
  const ia = d / det
  const ib = -b / det
  const ic = -c / det
  const id = a / det
  const data = new Uint8Array(width * height * 3)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sx = ia * (x - tx) + ib * (y - ty)
      const sy = ic * (x - tx) + id * (y - ty)
      for (let ch = 0; ch < 3; ch += 1) data[(y * width + x) * 3 + ch] = sample(image, sx, sy, ch)
    }
  }

  return { data, width, height }
}

/**
 * Crop a region (clamped to the image) and resize it to `width` x `height`.
 *
 * @param image
 * @param region `[x, y, w, h]` in source pixels.
 * @param width
 * @param height
 * @returns
 */
export function cropResize(
  image: RgbImage,
  region: [number, number, number, number],
  width: number,
  height: number,
): RgbImage {
  const [x, y, w, h] = region

  return warpAffine(image, [width / w, 0, (-x * width) / w, 0, height / h, (-y * height) / h], width, height)
}

/**
 * The image as a float NCHW tensor of raw 0-255 values, in RGB or BGR channel order.
 *
 * @param image
 * @param order
 * @returns
 */
export function toTensor(image: RgbImage, order: 'rgb' | 'bgr'): Float32Array {
  const plane = image.width * image.height
  const tensor = new Float32Array(plane * 3)
  const channels = order === 'rgb' ? [0, 1, 2] : [2, 1, 0]

  for (let i = 0; i < plane; i += 1) {
    for (let ch = 0; ch < 3; ch += 1) tensor[ch * plane + i] = image.data[i * 3 + channels[ch]!]!
  }

  return tensor
}
