import { beforeEach, describe, expect, it, vi } from 'vitest'

// A 640x480 frame whose detected face is `faceHeight` pixels tall, centred.
let faceHeight = 150
const run = vi.fn(async () => ({ output: Float32Array.from([0.1, 0.9, 0.1]) }))

vi.mock('@arkyc/vision', () => ({
  ModelStore: class {
    path(name: string) {
      return `/models/${name}`
    }
  },
  FaceDetector: {
    load: async () => ({
      detect: async () => [
        { box: [320 - faceHeight / 2, 240 - faceHeight / 2, faceHeight, faceHeight], landmarks: [], score: 0.9 },
      ],
    }),
  },
  OnnxModel: { load: async () => ({ run }) },
  decodeImage: async () => ({ width: 640, height: 480, data: new Uint8Array(640 * 480 * 3) }),
  cropResize: () => ({ width: 80, height: 80, data: new Uint8Array(80 * 80 * 3) }),
  toTensor: () => new Float32Array(3 * 80 * 80),
}))

const { LocalLivenessDriver } = await import('../src/drivers/local')

const check = () =>
  new LocalLivenessDriver({ modelDirectory: '/models' }).check({
    selfie: new Uint8Array([1]),
    mode: 'passive',
  } as never)

describe('LocalLivenessDriver framing', () => {
  beforeEach(() => run.mockClear())

  it('scores a well-framed face and records how it was framed', async () => {
    faceHeight = 150 // ~31% of the frame: the 2.7x crop fits

    const result = await check()

    expect(run).toHaveBeenCalled()
    expect(result.passed).toBe(true)
    expect(result.raw).toMatchObject({ faceHeightRatio: 0.313, cropScale: 2.7 })
  })

  it('sends a face that fills the frame to review instead of calling it a spoof', async () => {
    faceHeight = 460 // ~96% of the frame: the crop can't be wider than the face

    const result = await check()

    // The anti-spoofing model never sees a crop it can't judge.
    expect(run).not.toHaveBeenCalled()
    expect(result.passed).toBe(true)
    expect(result.score).toBe(0) // below the liveness threshold → manual review
    expect(result.spoofSignals).toMatchObject({ faceTooClose: true, screenReplay: false })
    expect(result.raw).toMatchObject({ judged: false, faceHeightRatio: 0.958 })
  })
})
