import { NOTIFICATION_TYPE, type ScreeningHit } from '@arkyc/types'
import { Organization } from '@app/models/Organization'
import { Project } from '@app/models/Project'
import type { VerificationSession } from '@app/models/VerificationSession'
import { NotificationAudience } from './NotificationAudience'
import { NotificationEvent } from './NotificationEvent'

/** Notifications about verification sessions. */
export class SessionNotifications {
  /**
   * Tell the assignee a session was assigned to them.
   *
   * @param session
   * @param assigneeId
   * @param actorId
   */
  async assigned(session: VerificationSession, assigneeId: string, actorId: string | null): Promise<void> {
    if (assigneeId === actorId) return

    const context = await this.context(session)

    await NotificationEvent.make(NOTIFICATION_TYPE.reviewAssigned)
      .to([assigneeId])
      .by(actorId)
      .about({
        title: 'Review assigned to you',
        description: `${this.label(session)} in ${context.projectName} is waiting for your review.`,
        actionText: 'Review session',
        actionLink: context.link,
        meta: context.meta,
        tag: `review:${session.id}`,
      })
      .dispatchSafely()
  }

  /**
   * Tell the project's reviewers a session needs a manual decision.
   *
   * @param session
   */
  async needsReview(session: VerificationSession): Promise<void> {
    const context = await this.context(session)

    await NotificationEvent.make(NOTIFICATION_TYPE.sessionNeedsReview)
      .toAudience(() => NotificationAudience.sessionReviewers(session))
      .about({
        title: 'Session needs review',
        description: `${this.label(session)} in ${context.projectName} needs a manual decision.`,
        actionText: 'Review session',
        actionLink: context.link,
        meta: context.meta,
        tag: `session:${session.id}`,
      })
      .dispatchSafely()
  }

  /**
   * Tell the assignee when someone else decides a session assigned to them.
   *
   * @param session
   * @param decision
   * @param actorId
   */
  async decided(
    session: VerificationSession,
    decision: 'approved' | 'rejected',
    actorId: string | null,
  ): Promise<void> {
    if (!session.assignedTo || session.assignedTo === actorId) return

    const context = await this.context(session)

    await NotificationEvent.make(NOTIFICATION_TYPE.reviewDecided)
      .to([session.assignedTo])
      .by(actorId)
      .about({
        title: decision === 'approved' ? 'Assigned session approved' : 'Assigned session rejected',
        description: `${this.label(session)} in ${context.projectName}, assigned to you, was ${decision} by another reviewer.`,
        actionText: 'View session',
        actionLink: context.link,
        meta: { ...context.meta, decision },
        tag: `review:${session.id}`,
      })
      .dispatchSafely()
  }

  /**
   * Tell the project's reviewers a session matched a watchlist.
   *
   * @param session
   * @param hits
   * @param monitoring Whether the hit came from re-screening a completed session.
   */
  async screeningHit(session: VerificationSession, hits: ScreeningHit[], monitoring = false): Promise<void> {
    if (!hits.length) return

    const context = await this.context(session)
    const best = hits[0]!

    await NotificationEvent.make(NOTIFICATION_TYPE.screeningHit)
      .toAudience(() => NotificationAudience.sessionReviewers(session))
      .about({
        title: monitoring ? 'New watchlist match' : 'Watchlist match',
        description: `${this.label(session)} in ${context.projectName} matched ${best.name} (${best.category.replace('_', ' ')})${hits.length > 1 ? ` and ${hits.length - 1} more` : ''}.`,
        actionText: 'Review session',
        actionLink: context.link,
        meta: { ...context.meta, entity_ids: hits.map((hit) => hit.entity_id).join(',') },
        tag: `screening:${session.id}`,
      })
      .dispatchSafely()
  }

  private label(session: VerificationSession): string {
    return session.userReference ? `Session for ${session.userReference}` : `Session ${session.id.slice(0, 8)}`
  }

  private async context(session: VerificationSession) {
    const [organization, project] = await Promise.all([
      Organization.where({ id: session.organizationId })
        .first()
        .catch(() => null),
      Project.where({ id: session.projectId })
        .first()
        .catch(() => null),
    ])

    return {
      projectName: project?.name ?? 'your project',
      link: organization ? `/o/${organization.slug}/sessions/${session.id}` : null,
      meta: {
        session_id: session.id,
        organization_id: session.organizationId,
        project_id: session.projectId,
      },
    }
  }
}

/** Shared singleton. */
export const sessionNotifications = new SessionNotifications()
