import type { LivenessResultData } from '@arkyc/types'
import type { LivenessDriver, LivenessRequest } from '../types'

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))

/**
 * Deterministic liveness driver for development + tests. Passes by default;
 * `hints` steer the score, verdict, and multiple-face spoof signal.
 */
export class MockLivenessDriver implements LivenessDriver {
  readonly name = 'mock'

  async check(request: LivenessRequest): Promise<LivenessResultData> {
    const score = clamp01(request.hints?.score ?? 0.94)
    const passed = request.hints?.passed ?? score >= 0.5

    return {
      passed,
      score,
      spoofSignals: {
        screenReplay: false,
        printedPhoto: false,
        maskDetected: false,
        multipleFaces: request.hints?.multipleFaces ?? false,
        faceNotCentered: false,
        poorLighting: false,
      },
      raw: { provider: 'mock', score },
    }
  }
}
