import { NOTIFICATION_TYPE, type AccessCapability } from '@arkyc/types'
import type { BusinessVerification } from '@app/models/BusinessVerification'
import type { Organization } from '@app/models/Organization'
import type { Project } from '@app/models/Project'
import { NotificationAudience } from './NotificationAudience'
import { NotificationEvent } from './NotificationEvent'

/** Notifications, in-app and by email, to platform admins about work waiting in their review queues. */
export class AdminNotifications {
  /**
   * Tell the admins who decide business verifications that a submission is waiting.
   *
   * @param organization
   * @param verification
   * @param submittedBy
   */
  async businessVerificationSubmitted(
    organization: Organization,
    verification: BusinessVerification,
    submittedBy: string,
  ): Promise<void> {
    await NotificationEvent.make(NOTIFICATION_TYPE.businessVerificationSubmitted)
      .toAudience(async () => NotificationAudience.platformAdmins('admin.organizations.manage'))
      .by(submittedBy)
      .viaEmail()
      .about({
        title: 'Business verification awaiting review',
        description: `${organization.name} submitted its business verification (${verification.legalName}, ${verification.country}) for review.`,
        actionText: 'Review submission',
        actionLink: `/admin/business-verifications/${verification.id}`,
        meta: { organization_id: organization.id, verification_id: verification.id },
        tag: `admin-business-verification:${verification.id}`,
      })
      .dispatchSafely()
  }

  /**
   * Tell the admins who decide extended access that a project requested capabilities.
   *
   * @param project
   * @param capabilities
   * @param requestedBy
   */
  async extendedAccessRequested(
    project: Project,
    capabilities: AccessCapability[],
    requestedBy: string | null,
  ): Promise<void> {
    if (!capabilities.length) return

    await NotificationEvent.make(NOTIFICATION_TYPE.extendedAccessRequested)
      .toAudience(async () => NotificationAudience.platformAdmins('admin.extended_access.manage'))
      .by(requestedBy)
      .viaEmail()
      .about({
        title: 'Extended access awaiting review',
        description: `${project.name} requested ${capabilities.map((c) => c.toUpperCase()).join(', ')} access.`,
        actionText: 'Review request',
        actionLink: `/admin/extended-access/${project.id}`,
        meta: { organization_id: project.organizationId, project_id: project.id, capabilities },
        tag: `admin-extended-access:${project.id}`,
      })
      .dispatchSafely()
  }
}

/** Shared singleton. */
export const adminNotifications = new AdminNotifications()
