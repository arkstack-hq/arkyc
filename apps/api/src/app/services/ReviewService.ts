import { RequestException } from '@arkstack/common'
import { assertTransition } from '@arkyc/core'
import type { DecisionReason, Metadata, VerificationDecision, VerificationStatus } from '@arkyc/types'
import { VerificationSession } from '@app/models/VerificationSession'
import { Review } from '@app/models/Review'
import { ReviewNote } from '@app/models/ReviewNote'
import { type AuditActor, audit } from './AuditLogger'

/** What a reviewer is asking the user to redo. */
export type RetryKind = 'document' | 'selfie' | 'full'

/**
 * Human-in-the-loop review actions (Phase 9). Each action transitions the
 * session, records a `reviews` row capturing the before/after, stamps
 * `reviewed_at`/`reviewed_by`, and emits an audit-trail entry.
 */
export class ReviewService {
  /** Manually approve a session awaiting review. */
  async approve (session: VerificationSession, actor: AuditActor, reason?: string): Promise<VerificationSession> {
    return this.decide(session, actor, 'approved', 'MANUAL_APPROVAL', 'review.approved', reason)
  }

  /** Manually reject a session awaiting review. */
  async reject (session: VerificationSession, actor: AuditActor, reason?: string): Promise<VerificationSession> {
    return this.decide(session, actor, 'rejected', 'MANUAL_REJECTION', 'review.rejected', reason)
  }

  /** Send the session back for a document, selfie, or full retry. */
  async requestRetry (
    session: VerificationSession,
    actor: AuditActor,
    kind: RetryKind,
    reason?: string,
  ): Promise<VerificationSession> {
    this.assertAwaitingReview(session)
    const to: VerificationStatus = kind === 'selfie' ? 'document_submitted' : 'started'
    const previousStatus = session.status

    session.status = assertTransition(session.status, to)
    session.reviewedAt = new Date()
    session.reviewedBy = actor.actorId
    await session.save()

    await this.recordReview(session, actor, previousStatus, to, reason ?? null)
    await this.emit(session, actor, `review.retry_${kind}`, { kind, reason: reason ?? null })

    return session
  }

  /** Assign the session to a reviewer (no status change). */
  async assign (session: VerificationSession, actor: AuditActor, assigneeId: string): Promise<VerificationSession> {
    session.assignedTo = assigneeId
    await session.save()
    await this.emit(session, actor, 'review.assigned', { assigneeId })

    return session
  }

  /** Flag a session as suspicious — records a review row + audit, no status change. */
  async markSuspicious (session: VerificationSession, actor: AuditActor, reason?: string): Promise<VerificationSession> {
    await this.recordReview(session, actor, session.status, session.status, reason ?? 'suspicious')
    await this.emit(session, actor, 'review.suspicious', { reason: reason ?? null })

    return session
  }

  /** Attach a reviewer note without changing the session's status. */
  async addNote (session: VerificationSession, actor: AuditActor, note: string): Promise<ReviewNote> {
    const row = await ReviewNote.create({
      tenantId: session.tenantId,
      projectId: session.projectId,
      sessionId: session.id,
      reviewerId: actor.actorId as string,
      note,
    })
    await this.emit(session, actor, 'review.note', { note })

    return row
  }

  /** Shared approve/reject path. */
  private async decide (
    session: VerificationSession,
    actor: AuditActor,
    decision: Extract<VerificationDecision, 'approved' | 'rejected'>,
    reasonCode: DecisionReason,
    action: string,
    reason?: string,
  ): Promise<VerificationSession> {
    this.assertAwaitingReview(session)
    const previousStatus = session.status

    session.status = assertTransition(session.status, decision)
    session.finalDecision = decision
    session.decisionReason = reasonCode
    session.reviewedAt = new Date()
    session.reviewedBy = actor.actorId
    session.completedAt = new Date()
    await session.save()

    await this.recordReview(session, actor, previousStatus, decision, reason ?? null)
    await this.emit(session, actor, action, { reason: reason ?? null })

    return session
  }

  /** Only a `requires_review` session can be acted on. */
  private assertAwaitingReview (session: VerificationSession): void {
    RequestException.abortIf(
      session.status !== 'requires_review',
      `Session is ${session.status}, not awaiting review`,
      409,
    )
  }

  private async recordReview (
    session: VerificationSession,
    actor: AuditActor,
    previousStatus: VerificationStatus,
    newStatus: VerificationStatus,
    reason: string | null,
  ): Promise<void> {
    await Review.create({
      tenantId: session.tenantId,
      projectId: session.projectId,
      sessionId: session.id,
      reviewerId: actor.actorId,
      previousStatus,
      newStatus,
      reason,
      note: null,
    })
  }

  private async emit (
    session: VerificationSession,
    actor: AuditActor,
    action: string,
    metadata: Metadata,
  ): Promise<void> {
    await audit.record({
      tenantId: session.tenantId,
      projectId: session.projectId,
      actorId: actor.actorId,
      actorType: actor.actorType,
      action,
      entityType: 'verification_session',
      entityId: session.id,
      metadata,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    })
  }
}

/** Shared singleton review service. */
export const reviewService = new ReviewService()
