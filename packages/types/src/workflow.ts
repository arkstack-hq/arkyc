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
export type WorkflowStepKey = 'document' | 'address' | 'liveness' | 'face_match'

/**
 * The default pipeline's stages, in canonical order — what runs when a session
 * has no workflow. `address` is deliberately NOT here: it's an opt-in stage,
 * available only on custom workflows.
 */
export const WORKFLOW_STEP_KEYS: readonly WorkflowStepKey[] = ['document', 'liveness', 'face_match']

/**
 * Every stage a custom workflow may include, in canonical order. Used by the
 * workflow editor and to validate/normalise stored steps — a superset of
 * {@link WORKFLOW_STEP_KEYS} that adds the opt-in `address` stage.
 */
export const AVAILABLE_WORKFLOW_STEP_KEYS: readonly WorkflowStepKey[] = [
  'document',
  'address',
  'liveness',
  'face_match',
]

/** A method the address stage uses to corroborate the user's address. */
export type AddressMethod = 'poa_document' | 'device_location' | 'geocode_lookup'

/** Every selectable address-verification method, in display order. */
export const ADDRESS_METHODS: readonly AddressMethod[] = ['poa_document', 'device_location', 'geocode_lookup']

/** What a failed/low-confidence address result does to the session. */
export type AddressOnFail = 'review' | 'reject'

/** Configuration for the `address` stage, carried on its {@link WorkflowStep}. */
export interface AddressStepConfig {
  /** Methods to run; at least one when the stage is enabled. */
  methods: AddressMethod[]
  /**
   * What a failed or low-confidence result does. `review` (default) flags the
   * session for a human; `reject` fails it outright.
   */
  on_fail: AddressOnFail
}

/** The default address config applied when the stage is enabled without one. */
export const DEFAULT_ADDRESS_CONFIG: AddressStepConfig = {
  methods: ['geocode_lookup'],
  on_fail: 'review',
}

/** One stage within a workflow, in pipeline order, on or off. */
export interface WorkflowStep {
  key: WorkflowStepKey
  enabled: boolean
  /** Stage-specific configuration. Only the `address` stage uses this today. */
  config?: AddressStepConfig
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
  // No workflow runs the default pipeline only — opt-in stages (`address`) are
  // off unless a custom workflow turns them on.
  if (!config) return WORKFLOW_STEP_KEYS.includes(key)

  return config.steps.some((step) => step.key === key && step.enabled)
}

/**
 * The resolved address config for a session's workflow, or `null` when the
 * address stage isn't enabled. Missing fields fall back to {@link DEFAULT_ADDRESS_CONFIG}.
 */
export function workflowAddressConfig(config: WorkflowConfig | null | undefined): AddressStepConfig | null {
  if (!config) return null
  const step = config.steps.find((s) => s.key === 'address' && s.enabled)
  if (!step) return null

  return { ...DEFAULT_ADDRESS_CONFIG, ...(step.config ?? {}) }
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
