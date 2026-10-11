import { describe, expect, it } from 'vitest'
import { cropResize, similarityTransform, toTensor, type RgbImage } from '../src/index'

describe('similarityTransform', () => {
  it('recovers a rotation, scale and shift', () => {
    const from: Array<[number, number]> = [
      [0, 0],
      [10, 0],
      [0, 10],
      [10, 10],
      [5, 5],
    ]
    const angle = Math.PI / 6
    const [a, b] = [2 * Math.cos(angle), 2 * Math.sin(angle)]
    const to = from.map(([x, y]) => [a * x - b * y + 3, b * x + a * y - 4] as [number, number])

    const m = similarityTransform(from, to)
    expect(m.map((v) => Number(v.toFixed(6)))).toEqual([a, -b, 3, b, a, -4].map((v) => Number(v.toFixed(6))))
  })
})

describe('image helpers', () => {
  const image: RgbImage = {
    width: 2,
    height: 2,
    data: new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]),
  }

  it('crops and resizes, sampling bilinearly', () => {
    expect(Array.from(cropResize(image, [0, 0, 1, 1], 1, 1).data)).toEqual([10, 20, 30])
  })

  it('builds planar tensors in either channel order', () => {
    expect(Array.from(toTensor(image, 'rgb')).slice(0, 4)).toEqual([10, 40, 70, 100])
    expect(Array.from(toTensor(image, 'bgr')).slice(0, 4)).toEqual([30, 60, 90, 120])
  })
})
