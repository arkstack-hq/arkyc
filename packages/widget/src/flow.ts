import {
  type DocumentType,
  type LivenessMode,
  type VerificationDecision,
  type VerificationStatus,
  type WidgetStep,
  type WorkflowConfig,
  type WorkflowStepKey,
  workflowEnabledSteps,
  workflowRunsOcr,
} from '@arkyc/types'

/** Context that influences flow branching. */
export interface FlowContext {
  documentType?: DocumentType | null
  /** Which liveness flow this session runs (resolved from the capture model). */
  livenessMode?: LivenessMode
  /** The applied workflow (orders/toggles the coarse stages), or null for the default flow. */
  workflow?: WorkflowConfig | null
}

/** The widget screens that make up each coarse verification stage, in stage-local order. */
const STAGE_STEPS: Record<WorkflowStepKey, WidgetStep[]> = {
  document: ['document_selection', 'front_capture', 'back_capture', 'ocr_processing'],
  address: ['address_entry', 'address_processing'],
  liveness: ['active_liveness', 'selfie_capture', 'passive_liveness'],
  face_match: ['face_match'],
}

/**
 * The verification flow's step machine. Stateless — exposed as static members so
 * the single "flow" concern lives in one class rather than as floating helpers.
 */
export class Flow {
  /**
   * The flow screens, in the order the widget walks them. The `back_capture`
   * screen is skipped for single-sided documents (passports).
   */
  static readonly STEP_ORDER: WidgetStep[] = [
    'welcome',
    'document_selection',
    'front_capture',
    'back_capture',
    'ocr_processing',
    'active_liveness',
    'selfie_capture',
    'passive_liveness',
    'face_match',
    'processing',
    'result',
  ]

  /**
   * Statuses from which a session can no longer progress.
   */
  static readonly TERMINAL_STATUSES: VerificationStatus[] = [
    'approved',
    'rejected',
    'requires_review',
    'expired',
    'cancelled',
  ]

  /**
   * Whether a document type has a second (back) side to capture.
   *
   * @param type
   * @returns
   */
  static documentHasBack(type: DocumentType | null | undefined): boolean {
    return type != null && type !== 'passport'
  }

  /**
   * The screens to walk for this session, in order. With no workflow this is the
   * default {@link STEP_ORDER}; a workflow reorders the coarse stages and drops
   * disabled ones (their screens are excluded entirely), always bracketed by
   * `welcome` and `processing`/`result`.
   */
  static stepOrder(ctx: FlowContext = {}): WidgetStep[] {
    const stages = workflowEnabledSteps(ctx.workflow) as WorkflowStepKey[]
    const middle = stages.flatMap((stage) => STAGE_STEPS[stage])

    return ['welcome', ...middle, 'processing', 'result']
  }

  /**
   * Whether a step runs for the given context. `back_capture` is skipped for
   * single-sided documents; `ocr_processing` is skipped when the workflow skips
   * OCR; the liveness steps branch on the resolved mode — `active_liveness` only
   * in active mode, `selfie_capture`/`passive_liveness` only in passive mode.
   * Stage-level disabling is handled by {@link stepOrder} (disabled stages are
   * absent from the order), so this only covers within-stage branching.
   */
  static isStepEnabled(step: WidgetStep, ctx: FlowContext = {}): boolean {
    if (step === 'back_capture') return Flow.documentHasBack(ctx.documentType)
    if (step === 'ocr_processing') return workflowRunsOcr(ctx.workflow)
    if (step === 'active_liveness') return ctx.livenessMode === 'active'
    if (step === 'selfie_capture' || step === 'passive_liveness') {
      return ctx.livenessMode !== 'active'
    }
    return true
  }

  /**
   * The next enabled screen after `current`, honouring the workflow order and the
   * branch rules. Returns `current` when already at the end.
   *
   * @param current
   * @param ctx
   * @returns
   */
  static nextStep(current: WidgetStep, ctx: FlowContext = {}): WidgetStep {
    const order = Flow.stepOrder(ctx)
    const idx = order.indexOf(current)
    if (idx < 0) return current
    for (let i = idx + 1; i < order.length; i += 1) {
      const step = order[i]!
      if (Flow.isStepEnabled(step, ctx)) return step
    }
    return current
  }

  /**
   * Whether a session status is terminal (the flow is done).
   *
   * @param status
   * @returns
   */
  static isTerminal(status: VerificationStatus): boolean {
    return Flow.TERMINAL_STATUSES.includes(status)
  }

  /**
   * Map a terminal session status to the decision the integrator cares about.
   * Non-decision terminals (`expired`/`cancelled`) and in-flight statuses map to
   * `null`.
   */
  static statusToDecision(status: VerificationStatus): VerificationDecision | null {
    switch (status) {
      case 'approved':
        return 'approved'
      case 'rejected':
        return 'rejected'
      case 'requires_review':
        return 'requires_review'
      default:
        return null
    }
  }
}
