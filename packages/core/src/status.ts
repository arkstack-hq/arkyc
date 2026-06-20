import type { VerificationStatus } from '@arkyc/types';

/**
 * Allowed status transitions for a verification session.
 *
 * The happy path is:
 *   pending → started → document_submitted → liveness_submitted → processing
 *   → (approved | rejected | requires_review)
 *
 * `requires_review` can move to a terminal decision (manual) or back for a
 * retry. `expired` and `cancelled` are reachable from any non-terminal state.
 */
export const STATUS_TRANSITIONS: Readonly<Record<VerificationStatus, readonly VerificationStatus[]>> =
  {
    pending: ['started', 'expired', 'cancelled'],
    started: ['document_submitted', 'expired', 'cancelled'],
    document_submitted: ['liveness_submitted', 'processing', 'expired', 'cancelled'],
    liveness_submitted: ['processing', 'expired', 'cancelled'],
    processing: ['approved', 'rejected', 'requires_review', 'expired', 'cancelled'],
    requires_review: ['approved', 'rejected', 'started', 'document_submitted', 'cancelled'],
    approved: [],
    rejected: [],
    expired: [],
    cancelled: [],
  };

/** Statuses from which no further transition is possible. */
export const TERMINAL_STATUSES: readonly VerificationStatus[] = [
  'approved',
  'rejected',
  'expired',
  'cancelled',
];

/** Whether `status` is terminal (no further transitions allowed). */
export function isTerminalStatus(status: VerificationStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** Whether moving from `from` to `to` is a permitted transition. */
export function canTransition(from: VerificationStatus, to: VerificationStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}

/** Thrown when an illegal status transition is attempted. */
export class InvalidStatusTransitionError extends Error {
  constructor(
    public readonly from: VerificationStatus,
    public readonly to: VerificationStatus,
  ) {
    super(`Invalid verification status transition: ${from} → ${to}`);
    this.name = 'InvalidStatusTransitionError';
  }
}

/**
 * Assert that `from → to` is permitted, throwing {@link InvalidStatusTransitionError}
 * otherwise. Returns `to` so it can be used inline.
 */
export function assertTransition(
  from: VerificationStatus,
  to: VerificationStatus,
): VerificationStatus {
  if (!canTransition(from, to)) {
    throw new InvalidStatusTransitionError(from, to);
  }
  return to;
}
