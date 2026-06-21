import type { DocumentType, VerificationDecision, VerificationStatus, WidgetStep } from '@arkyc/types';

/**
 * The verification flow screens, in the order the widget walks them. The
 * `back_capture` screen is skipped for single-sided documents (passports).
 */
export const STEP_ORDER: WidgetStep[] = [
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

/** Whether a document type has a second (back) side to capture. */
export function documentHasBack(type: DocumentType | null | undefined): boolean {
  return type != null && type !== 'passport';
}

/** Context that influences flow branching. */
export interface FlowContext {
  documentType?: DocumentType | null;
}

/**
 * The next screen after `current`, honouring branch rules (skip `back_capture`
 * for single-sided documents). Returns `current` when already at the end.
 */
export function nextStep(current: WidgetStep, ctx: FlowContext = {}): WidgetStep {
  const idx = STEP_ORDER.indexOf(current);
  if (idx < 0 || idx >= STEP_ORDER.length - 1) return current;

  const next = STEP_ORDER[idx + 1]!;
  if (next === 'back_capture' && !documentHasBack(ctx.documentType)) {
    return STEP_ORDER[idx + 2] ?? next;
  }
  return next;
}

/** Statuses from which a session can no longer progress. */
export const TERMINAL_STATUSES: VerificationStatus[] = [
  'approved',
  'rejected',
  'requires_review',
  'expired',
  'cancelled',
];

/** Whether a session status is terminal (the flow is done). */
export function isTerminal(status: VerificationStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * Map a terminal session status to the decision the integrator cares about.
 * Non-decision terminals (`expired`/`cancelled`) and in-flight statuses map to
 * `null`.
 */
export function statusToDecision(status: VerificationStatus): VerificationDecision | null {
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
