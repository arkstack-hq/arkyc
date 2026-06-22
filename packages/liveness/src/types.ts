import type { LivenessChallenge, LivenessMode, LivenessResultData } from '@arkyc/types'

/** The selfie/video bytes + context handed to a liveness driver. */
export interface LivenessRequest {
  /** Raw selfie frame bytes. */
  selfie: Uint8Array
  /** Optional short liveness video bytes (active mode). */
  video?: Uint8Array | null
  /** Passive (selfie) or active (challenge video). Defaults to passive. */
  mode?: LivenessMode
  /** The challenge sequence the server issued for this session (active mode). */
  challenges?: readonly LivenessChallenge[]
  /** The challenge sequence the client reports having performed (active mode). */
  performedChallenges?: readonly LivenessChallenge[]
  /**
   * Optional deterministic signals (used by the `mock` driver and tests to
   * steer the score / verdict). Ignored by real drivers.
   */
  hints?: { score?: number; passed?: boolean; multipleFaces?: boolean }
}

/** A pluggable liveness provider (passive selfie or active challenge video). */
export interface LivenessDriver {
  readonly name: string
  check(request: LivenessRequest): Promise<LivenessResultData>
}

/** Identifier for a registered liveness driver. */
export type LivenessDriverName = 'mock' | 'external'

/** Configuration selecting + parameterising the active liveness driver. */
export interface LivenessConfig {
  driver: LivenessDriverName
  endpoint?: string
  apiKey?: string
}
