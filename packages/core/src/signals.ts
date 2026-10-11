import {
  DEFAULT_RISK_SIGNAL_POLICY,
  REVIEW_ONLY_RISK_SIGNALS,
  RISK_SIGNAL_KEYS,
  RISK_SIGNAL_REASONS,
  type DecisionReason,
  type RiskPolicyConfig,
  type RiskSeverity,
  type RiskSignal,
  type RiskSignalPolicy,
} from '@arkyc/types'

const POLICY_SEVERITY: Record<RiskSignalPolicy, RiskSeverity> = {
  ignore: 'info',
  review: 'review',
  reject: 'reject',
}

/** Policy resolution and precedence for risk signals. */
export class RiskSignals {
  /**
   * Resolve each signal's severity from the workflow policy. `info` signals stay
   * informational, advisory and review-only signals never exceed review.
   *
   * @param signals
   * @param policy
   * @returns
   */
  static applyPolicy<T extends RiskSignal>(signals: T[], policy: RiskPolicyConfig = {}): T[] {
    return signals.map((signal) => {
      if (signal.severity === 'info') return signal

      let severity = POLICY_SEVERITY[policy[signal.key] ?? DEFAULT_RISK_SIGNAL_POLICY]
      const capped = signal.advisory === true || REVIEW_ONLY_RISK_SIGNALS.includes(signal.key)
      if (severity === 'reject' && capped) severity = 'review'

      return { ...signal, severity }
    })
  }

  /**
   * The reason of the highest-precedence signal at `severity`, or `null`.
   *
   * @param signals
   * @param severity
   * @returns
   */
  static reasonFor(signals: RiskSignal[], severity: Exclude<RiskSeverity, 'info'>): DecisionReason | null {
    const keys = new Set(signals.filter((signal) => signal.severity === severity).map((signal) => signal.key))
    const key = RISK_SIGNAL_KEYS.find((candidate) => keys.has(candidate))

    return key ? RISK_SIGNAL_REASONS[key] : null
  }
}
