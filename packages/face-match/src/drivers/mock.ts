import type { FaceMatchResultData } from '@arkyc/types';
import type { FaceMatchDriver, FaceMatchRequest } from '../types';

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/**
 * Deterministic face-match driver for development + tests. Passes by default;
 * `hints` steer the similarity score and verdict.
 */
export class MockFaceMatchDriver implements FaceMatchDriver {
  readonly name = 'mock';

  async compare(request: FaceMatchRequest): Promise<FaceMatchResultData> {
    const similarityScore = clamp01(request.hints?.similarityScore ?? 0.9);
    const passed = request.hints?.passed ?? similarityScore >= 0.5;

    return {
      passed,
      similarityScore,
      confidence: 0.93,
      raw: { provider: 'mock', similarityScore },
    };
  }
}
