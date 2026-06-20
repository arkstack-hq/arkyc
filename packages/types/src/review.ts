import type { Entity, Id, ProjectScoped } from './common';
import type { VerificationStatus } from './verification';

/** Actions a human reviewer can take on a session. */
export type ReviewAction =
  | 'approve'
  | 'reject'
  | 'request_document_retry'
  | 'request_selfie_retry'
  | 'request_full_retry'
  | 'mark_suspicious'
  | 'note';

/**
 * An audited review action recording a status transition performed by a
 * reviewer (or the system) on a session.
 */
export interface Review extends Entity, ProjectScoped {
  session_id: Id;
  reviewer_id: Id | null;
  previous_status: VerificationStatus;
  new_status: VerificationStatus;
  reason: string | null;
  note: string | null;
}

/** A free-standing reviewer note attached to a session. */
export interface ReviewNote extends Entity, ProjectScoped {
  session_id: Id;
  reviewer_id: Id;
  note: string;
}
