import type { LivenessResultData } from '@arkyc/types'
import type { LivenessDriver, LivenessRequest } from '../types'
import { challengesMatch } from '../challenges'

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))

/**
 * Deterministic liveness driver for development + tests. Passes by default;
 * `hints` steer the score, verdict, and multiple-face spoof signal. In `active`
 * mode it also requires the performed challenge sequence to match the one issued
 * — a mismatch reads as a replay attempt and fails the check.
 */
export class MockLivenessDriver implements LivenessDriver {
  readonly name = 'mock'

  async check(request: LivenessRequest): Promise<LivenessResultData> {
    const score = clamp01(request.hints?.score ?? 0.94)
    let passed = request.hints?.passed ?? score >= 0.5

    // Active liveness: the recorded challenge order must match what was issued.
    const active = request.mode === 'active'
    const sequenceOk = active ? challengesMatch(request.challenges ?? [], request.performedChallenges ?? []) : true
    if (active && !sequenceOk) passed = false

    return {
      passed,
      score: sequenceOk ? score : Math.min(score, 0.3),
      spoofSignals: {
        screenReplay: active && !sequenceOk,
        printedPhoto: false,
        maskDetected: false,
        multipleFaces: request.hints?.multipleFaces ?? false,
        faceNotCentered: false,
        poorLighting: false,
      },
      raw: { provider: 'mock', score, mode: request.mode ?? 'passive', sequenceOk },
    }
  }
}
