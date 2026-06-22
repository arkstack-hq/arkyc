import { describe, expect, it } from 'vitest'
import { isSelfieReady, makeChallengeDetector, type FaceSample } from '../src/face'

const base: FaceSample = {
  present: true,
  centerX: 0.5,
  centerY: 0.5,
  scale: 0.5,
  turn: 0,
  pitch: 0.4,
  blink: 0,
  smile: 0,
}
const s = (o: Partial<FaceSample> = {}): FaceSample => ({ ...base, ...o })

describe('isSelfieReady', () => {
  it('accepts a centred, well-sized face', () => {
    expect(isSelfieReady(s())).toBe(true)
  })
  it('rejects no face, off-centre, too small or too large', () => {
    expect(isSelfieReady(s({ present: false }))).toBe(false)
    expect(isSelfieReady(s({ centerX: 0.9 }))).toBe(false)
    expect(isSelfieReady(s({ scale: 0.1 }))).toBe(false)
    expect(isSelfieReady(s({ scale: 0.95 }))).toBe(false)
  })
})

describe('makeChallengeDetector', () => {
  it('blink: fires on a closed → open transition, not before', () => {
    const d = makeChallengeDetector('blink')
    expect(d.feed(s({ blink: 0.8 }))).toBe(false) // eyes closed
    expect(d.feed(s({ blink: 0.1 }))).toBe(true) // re-opened
  })

  it('blink: does not fire without first closing', () => {
    const d = makeChallengeDetector('blink')
    expect(d.feed(s({ blink: 0.1 }))).toBe(false)
    expect(d.feed(s({ blink: 0.2 }))).toBe(false)
  })

  it('smile: fires after a few sustained frames', () => {
    const d = makeChallengeDetector('smile')
    expect(d.feed(s({ smile: 0.7 }))).toBe(false)
    expect(d.feed(s({ smile: 0.7 }))).toBe(false)
    expect(d.feed(s({ smile: 0.7 }))).toBe(true)
  })

  it('smile: a dip in the streak resets it', () => {
    const d = makeChallengeDetector('smile')
    d.feed(s({ smile: 0.7 }))
    d.feed(s({ smile: 0.1 })) // reset
    expect(d.feed(s({ smile: 0.7 }))).toBe(false)
  })

  it('turn_left / turn_right respond to the right sign', () => {
    const left = makeChallengeDetector('turn_left')
    expect(left.feed(s({ turn: -0.3 })) || left.feed(s({ turn: -0.3 })) || left.feed(s({ turn: -0.3 }))).toBe(true)
    const right = makeChallengeDetector('turn_right')
    expect(right.feed(s({ turn: -0.3 }))).toBe(false)
  })

  it('nod: baseline → dip → return fires', () => {
    const d = makeChallengeDetector('nod')
    expect(d.feed(s({ pitch: 0.4 }))).toBe(false) // baseline
    expect(d.feed(s({ pitch: 0.52 }))).toBe(false) // looking down
    expect(d.feed(s({ pitch: 0.41 }))).toBe(true) // back up
  })

  it('move_closer: fires when the face grows past the baseline', () => {
    const d = makeChallengeDetector('move_closer')
    expect(d.feed(s({ scale: 0.4 }))).toBe(false) // baseline
    expect(d.feed(s({ scale: 0.6 }))).toBe(false)
    expect(d.feed(s({ scale: 0.6 }))).toBe(false)
    expect(d.feed(s({ scale: 0.6 }))).toBe(true)
  })
})
