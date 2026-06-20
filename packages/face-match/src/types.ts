import type { FaceMatchResultData } from '@arkyc/types';

/** The two images compared by a face-match driver. */
export interface FaceMatchRequest {
  /** Portrait extracted from the identity document. */
  documentPortrait: Uint8Array;
  /** Selfie captured during liveness. */
  selfie: Uint8Array;
  /**
   * Optional deterministic signals (used by the `mock` driver and tests to
   * steer the similarity / verdict). Ignored by real drivers.
   */
  hints?: { similarityScore?: number; passed?: boolean };
}

/** A pluggable face-match provider. */
export interface FaceMatchDriver {
  readonly name: string;
  compare(request: FaceMatchRequest): Promise<FaceMatchResultData>;
}

/** Identifier for a registered face-match driver. */
export type FaceMatchDriverName = 'mock' | 'internal' | 'external';

/** Configuration selecting + parameterising the active face-match driver. */
export interface FaceMatchConfig {
  driver: FaceMatchDriverName;
  endpoint?: string;
  apiKey?: string;
}
