import { WORKFLOW_STEP_KEYS, type WorkflowOptions, type WorkflowStep, type WorkflowStepKey } from '@arkyc/types'

import { ValidationException } from 'kanun'

const KEY_SET = new Set<WorkflowStepKey>(WORKFLOW_STEP_KEYS)

/**
 * Normalise raw step input into a complete, ordered, de-duplicated stage list.
 *
 * The caller's order is preserved (that's the whole point of a workflow); any
 * stage they omit is appended as disabled so the stored config always names
 * every stage. Rejects unknown keys and an all-disabled workflow (≥1 stage must
 * run).
 */
export function normalizeWorkflowSteps(raw: unknown): WorkflowStep[] {
  if (!Array.isArray(raw)) {
    throw ValidationException.withMessages({ steps: ['Steps must be an array of stages.'] })
  }

  const enabledByKey = new Map<WorkflowStepKey, boolean>()
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
  }

  const steps: WorkflowStep[] = order.map((key) => ({ key, enabled: enabledByKey.get(key)! }))
  for (const key of WORKFLOW_STEP_KEYS) {
    if (!enabledByKey.has(key)) steps.push({ key, enabled: false })
  }

  if (!steps.some((step) => step.enabled)) {
    throw ValidationException.withMessages({ steps: ['A workflow must keep at least one stage enabled.'] })
  }

  return steps
}

/** Coerce raw options into the canonical shape. */
export function normalizeWorkflowOptions(raw: unknown): WorkflowOptions {
  return { skip_ocr: (raw as { skip_ocr?: unknown })?.skip_ocr === true }
}
