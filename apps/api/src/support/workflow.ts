import {
  ADDRESS_METHODS,
  AVAILABLE_WORKFLOW_STEP_KEYS,
  DEFAULT_ADDRESS_CONFIG,
  DEFAULT_SCREENING_CONFIG,
  RISK_SIGNAL_KEYS,
  type AddressMethod,
  type AddressStepConfig,
  type RiskPolicyConfig,
  type RiskSignalKey,
  type RiskSignalPolicy,
  type ScreeningStepConfig,
  type WorkflowOptions,
  type WorkflowStep,
  type WorkflowStepKey,
} from '@arkyc/types'

import { ValidationException } from 'kanun'

const KEY_SET = new Set<WorkflowStepKey>(AVAILABLE_WORKFLOW_STEP_KEYS)
const METHOD_SET = new Set<AddressMethod>(ADDRESS_METHODS)
const SIGNAL_SET = new Set<RiskSignalKey>(RISK_SIGNAL_KEYS)
const POLICIES = new Set<RiskSignalPolicy>(['ignore', 'review', 'reject'])

/** A number in [0, 1], or `fallback` when absent. */
function unitInterval(raw: unknown, fallback: number, message: string): number {
  if (raw == null || raw === '') return fallback

  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw ValidationException.withMessages({ steps: [message] })
  }

  return value
}

/** Validate + canonicalise the screening stage's config. */
function normalizeScreeningConfig(raw: unknown): ScreeningStepConfig {
  const config = (raw ?? {}) as Partial<Record<keyof ScreeningStepConfig, unknown>>

  return {
    threshold: unitInterval(
      config.threshold,
      DEFAULT_SCREENING_CONFIG.threshold,
      'The screening match threshold must be between 0 and 1.',
    ),
    on_hit: config.on_hit === 'reject' ? 'reject' : 'review',
    monitor: config.monitor === true,
  }
}

/** Validate + canonicalise the address stage's config (methods + on_fail + threshold). */
function normalizeAddressConfig(raw: unknown): AddressStepConfig {
  const methodsRaw = (raw as { methods?: unknown })?.methods
  const methods = Array.isArray(methodsRaw)
    ? [...new Set(methodsRaw.filter((m): m is AddressMethod => METHOD_SET.has(m as AddressMethod)))]
    : []

  if (methods.length === 0) {
    throw ValidationException.withMessages({ steps: ['The address stage needs at least one method.'] })
  }

  const onFail = (raw as { on_fail?: unknown })?.on_fail
  const config: AddressStepConfig = { methods, on_fail: onFail === 'reject' ? 'reject' : 'review' }

  const thresholdRaw = (raw as { auto_approve_threshold?: unknown })?.auto_approve_threshold
  if (thresholdRaw != null && thresholdRaw !== '') {
    const threshold = Number(thresholdRaw)
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
      throw ValidationException.withMessages({
        steps: ['The address auto-verify threshold must be between 0 and 1.'],
      })
    }
    config.auto_approve_threshold = threshold
  }

  return config
}

/**
 * Normalise raw step input into a complete, ordered, de-duplicated stage list.
 *
 * The caller's order is preserved (that's the whole point of a workflow); any
 * stage they omit is appended as disabled so the stored config always names
 * every stage. Rejects unknown keys and an all-disabled workflow (≥1 stage must
 * run). The opt-in `address` stage carries its method config when enabled.
 */
export function normalizeWorkflowSteps(raw: unknown): WorkflowStep[] {
  if (!Array.isArray(raw)) {
    throw ValidationException.withMessages({ steps: ['Steps must be an array of stages.'] })
  }

  const enabledByKey = new Map<WorkflowStepKey, boolean>()
  const configByKey = new Map<WorkflowStepKey, AddressStepConfig | ScreeningStepConfig>()
  const order: WorkflowStepKey[] = []

  for (const entry of raw) {
    const key = (entry as { key?: unknown })?.key as WorkflowStepKey
    if (!KEY_SET.has(key)) {
      throw ValidationException.withMessages({ steps: [`Unknown stage "${String(key)}".`] })
    }
    const enabled = (entry as { enabled?: unknown })?.enabled
    if (typeof enabled !== 'boolean') {
      throw ValidationException.withMessages({ steps: [`Stage "${key}" needs an "enabled" boolean.`] })
    }
    if (!enabledByKey.has(key)) order.push(key) // first occurrence sets position
    enabledByKey.set(key, enabled) // last occurrence wins
    if (key === 'address' && enabled) {
      configByKey.set(key, normalizeAddressConfig((entry as { config?: unknown })?.config))
    }
    if (key === 'screening' && enabled) {
      configByKey.set(key, normalizeScreeningConfig((entry as { config?: unknown })?.config))
    }
  }

  const steps: WorkflowStep[] = order.map((key) => {
    const step: WorkflowStep = { key, enabled: enabledByKey.get(key)! }
    if (key === 'address' && step.enabled) step.config = configByKey.get(key) ?? DEFAULT_ADDRESS_CONFIG
    if (key === 'screening' && step.enabled) step.config = configByKey.get(key) ?? DEFAULT_SCREENING_CONFIG

    return step
  })
  for (const key of AVAILABLE_WORKFLOW_STEP_KEYS) {
    if (!enabledByKey.has(key)) steps.push({ key, enabled: false })
  }

  if (!steps.some((step) => step.enabled)) {
    throw ValidationException.withMessages({ steps: ['A workflow must keep at least one stage enabled.'] })
  }

  return steps
}

/** Coerce raw options into the canonical shape. */
export function normalizeWorkflowOptions(raw: unknown): WorkflowOptions {
  const input = (raw ?? {}) as { skip_ocr?: unknown; min_age?: unknown; risk_policy?: unknown }
  const options: WorkflowOptions = { skip_ocr: input.skip_ocr === true }

  if (input.min_age != null && input.min_age !== '') {
    const minAge = Number(input.min_age)
    if (!Number.isInteger(minAge) || minAge < 1 || minAge > 120) {
      throw ValidationException.withMessages({ options: ['The minimum age must be a whole number from 1 to 120.'] })
    }
    options.min_age = minAge
  }

  const policy = normalizeRiskPolicy(input.risk_policy)
  if (Object.keys(policy).length) options.risk_policy = policy

  return options
}

/** Validate per-signal policies. */
function normalizeRiskPolicy(raw: unknown): RiskPolicyConfig {
  if (!raw || typeof raw !== 'object') return {}

  const policy: RiskPolicyConfig = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!SIGNAL_SET.has(key as RiskSignalKey)) {
      throw ValidationException.withMessages({ options: [`Unknown risk signal "${key}".`] })
    }
    if (!POLICIES.has(value as RiskSignalPolicy)) {
      throw ValidationException.withMessages({ options: [`Risk signal "${key}" needs ignore, review or reject.`] })
    }
    policy[key as RiskSignalKey] = value as RiskSignalPolicy
  }

  return policy
}
