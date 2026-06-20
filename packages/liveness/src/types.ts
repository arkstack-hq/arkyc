import type { LivenessResultData } from '@arkyc/types';

/** The selfie/video bytes + context handed to a liveness driver. */
export interface LivenessRequest {
  /** Raw selfie frame bytes. */
  selfie: Uint8Array;
  /** Optional short liveness video bytes. */
  video?: Uint8Array | null;
  /**
   * Optional deterministic signals (used by the `mock` driver and tests to
   * steer the score / verdict). Ignored by real drivers.
   */
  hints?: { score?: number; passed?: boolean; multipleFaces?: boolean };
}

/** A pluggable passive-liveness provider. */
export interface LivenessDriver {
  readonly name: string;
  check(request: LivenessRequest): Promise<LivenessResultData>;
}

/** Identifier for a registered liveness driver. */
export type LivenessDriverName = 'mock' | 'external';

/** Configuration selecting + parameterising the active liveness driver. */
export interface LivenessConfig {
  driver: LivenessDriverName;
  endpoint?: string;
  apiKey?: string;
}
