import type { DocumentType, VerificationDecision, VerificationStatus, WidgetStep } from '@arkyc/types';

/** Context that influences flow branching. */
export interface FlowContext {
  documentType?: DocumentType | null;
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
    'selfie_capture',
    'passive_liveness',
    'face_match',
    'processing',
    'result',
  ];

  /** Statuses from which a session can no longer progress. */
  static readonly TERMINAL_STATUSES: VerificationStatus[] = [
    'approved',
    'rejected',
    'requires_review',
    'expired',
    'cancelled',
  ];

  /** Whether a document type has a second (back) side to capture. */
  static documentHasBack(type: DocumentType | null | undefined): boolean {
    return type != null && type !== 'passport';
  }

  /**
   * The next screen after `current`, honouring branch rules (skip `back_capture`
   * for single-sided documents). Returns `current` when already at the end.
   */
  static nextStep(current: WidgetStep, ctx: FlowContext = {}): WidgetStep {
    const idx = Flow.STEP_ORDER.indexOf(current);
    if (idx < 0 || idx >= Flow.STEP_ORDER.length - 1) return current;

    const next = Flow.STEP_ORDER[idx + 1]!;
    if (next === 'back_capture' && !Flow.documentHasBack(ctx.documentType)) {
      return Flow.STEP_ORDER[idx + 2] ?? next;
    }
    return next;
  }

  /** Whether a session status is terminal (the flow is done). */
  static isTerminal(status: VerificationStatus): boolean {
    return Flow.TERMINAL_STATUSES.includes(status);
  }

  /**
   * Map a terminal session status to the decision the integrator cares about.
   * Non-decision terminals (`expired`/`cancelled`) and in-flight statuses map to
   * `null`.
   */
  static statusToDecision(status: VerificationStatus): VerificationDecision | null {
    switch (status) {
      case 'approved':
        return 'approved';
      case 'rejected':
        return 'rejected';
      case 'requires_review':
        return 'requires_review';
      default:
        return null;
    }
  }
}
