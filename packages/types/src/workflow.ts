import type { Id, IsoDateTime } from './common'

/**
 * Workflows (Phase 19).
 *
 * An organization-scoped, reusable recipe that determines the order of the
 * coarse verification stages, lets each be turned off, and can skip OCR parsing
 * (capture-only). Workflows are optional: a session created without one runs the
 * default pipeline (document → liveness → face match, OCR on). A workflow's
 * config is snapshotted onto each session at creation, so editing it never
 * disturbs sessions already in flight.
 */

/** A coarse verification stage a workflow can order and toggle. */
export type WorkflowStepKey = 'document' | 'liveness' | 'face_match'

/** The canonical stage order used as the default and to normalise stored steps. */
export const WORKFLOW_STEP_KEYS: readonly WorkflowStepKey[] = ['document', 'liveness', 'face_match']

/** One stage within a workflow, in pipeline order, on or off. */
export interface WorkflowStep {
  key: WorkflowStepKey
  enabled: boolean
}

/** Workflow-wide toggles. */
export interface WorkflowOptions {
  /**
   * Skip OCR parsing — capture the document image but don't extract fields.
   * Useful when Arkyc is only used for data capture and the assets are handed
   * to a third party. Disables the document portrait too, so face match can't run.
   */
  skip_ocr: boolean
}

/** The portable config of a workflow: ordered stages + options. */
export interface WorkflowConfig {
  steps: WorkflowStep[]
  options: WorkflowOptions
}

/** A saved, organization-scoped workflow. */
export interface Workflow extends WorkflowConfig {
  id: Id
  organization_id: Id
  name: string
  created_at: IsoDateTime
  updated_at: IsoDateTime
}

/** The default pipeline applied when a session has no workflow. */
export const DEFAULT_WORKFLOW_CONFIG: WorkflowConfig = {
  steps: [
    { key: 'document', enabled: true },
    { key: 'liveness', enabled: true },
    { key: 'face_match', enabled: true },
  ],
  options: { skip_ocr: false },
}

/**
 * Whether a stage runs under a config. A `null` config means "no workflow" — the
 * default pipeline, where every stage runs. Within a real config, a stage that is
 * absent or `enabled: false` does not run.
 */
export function workflowEnables(config: WorkflowConfig | null | undefined, key: WorkflowStepKey): boolean {
  if (!config) return true

  return config.steps.some((step) => step.key === key && step.enabled)
}

/** Whether OCR parsing should run: the document stage is on and `skip_ocr` is off. */
export function workflowRunsOcr(config: WorkflowConfig | null | undefined): boolean {
  if (!config) return true

  return workflowEnables(config, 'document') && !config.options.skip_ocr
}

/** The enabled stages in pipeline order (used by the widget to sequence its steps). */
export function workflowEnabledSteps(config: WorkflowConfig | null | undefined): WorkflowStepKey[] {
  if (!config) return [...WORKFLOW_STEP_KEYS]

  return config.steps.filter((step) => step.enabled).map((step) => step.key)
}
