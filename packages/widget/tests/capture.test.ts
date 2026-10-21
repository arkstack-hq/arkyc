import { describe, expect, it } from 'vitest'
import { Camera, type Facing } from '../src/capture'

/** A camera over a fake navigator that records the constraints it was opened with. */
function openCamera(facing: Facing): Promise<MediaStreamConstraints> {
  let requested: MediaStreamConstraints = {}
  const nav = {
    mediaDevices: {
      getUserMedia: async (constraints: MediaStreamConstraints) => {
        requested = constraints

        return { getTracks: () => [] } as unknown as MediaStream
      },
    },
  } as unknown as Navigator
  const video = { setAttribute: () => {}, play: async () => {} } as unknown as HTMLVideoElement

  return new Camera({} as Document, nav).start(video, facing).then(() => requested)
}

describe('Camera.start', () => {
  it('asks for 1080p from the document camera, so small print stays legible', async () => {
    expect((await openCamera('environment')).video).toEqual({
      facingMode: 'environment',
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    })
  })

  it('keeps the selfie camera at its default resolution', async () => {
    expect((await openCamera('user')).video).toEqual({ facingMode: 'user' })
  })
})
