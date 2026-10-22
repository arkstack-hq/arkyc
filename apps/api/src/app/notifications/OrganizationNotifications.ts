import { NOTIFICATION_TYPE } from '@arkyc/types'
import type { Organization } from '@app/models/Organization'
import { NotificationAudience } from './NotificationAudience'
import { NotificationEvent } from './NotificationEvent'

/** Notifications about an organization as a whole. */
export class OrganizationNotifications {
  /**
   * Tell the organization's managers how their business verification was decided.
   *
   * @param organization
   * @param decision
   * @param note
   * @param reviewerId
   */
  async verificationDecided(
    organization: Organization,
    decision: 'approved' | 'rejected',
    note: string | null,
    reviewerId: string,
  ): Promise<void> {
    const approved = decision === 'approved'

    await NotificationEvent.make(NOTIFICATION_TYPE.businessVerificationDecided)
      .toAudience(async () => NotificationAudience.withPermission('organizations.update', organization.id))
      .by(reviewerId)
      .about({
        title: approved ? 'Business verified' : 'Business verification rejected',
        description: approved
          ? `${organization.name} is verified and can now run production projects.`
          : `${organization.name}'s verification was rejected${note ? `: ${note}` : '.'} You can correct it and submit again.`,
        actionText: 'View verification',
        actionLink: `/o/${organization.slug}/settings`,
        meta: { organization_id: organization.id, decision },
        tag: `business-verification:${organization.id}`,
      })
      .dispatchSafely()
  }
}

/** Shared singleton. */
export const organizationNotifications = new OrganizationNotifications()
