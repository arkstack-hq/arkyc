import { DEFAULT_VERIFICATION_THRESHOLDS, type VerificationThresholds } from '@arkyc/types'

/** Verification threshold defaults and override resolution. */
export class Thresholds {
  /**
   * Platform default verification thresholds. Projects may override any subset
   * via `ProjectSettings.thresholds`; {@link Thresholds.resolve} merges them.
   */
  static readonly DEFAULTS: VerificationThresholds = DEFAULT_VERIFICATION_THRESHOLDS

  /**
   * Merge a partial set of project overrides over the platform defaults.
   *
   * @param overrides
   * @returns
   */
  static resolve(overrides?: Partial<VerificationThresholds>): VerificationThresholds {
    return { ...Thresholds.DEFAULTS, ...(overrides ?? {}) }
  }
}
