import { NOTIFICATION_TYPE } from '@arkyc/types'
import { Organization } from '@app/models/Organization'
import type { OrganizationInvitation } from '@app/models/OrganizationInvitation'
import { Role } from '@app/models/Role'
import { User } from '@app/models/User'
import { NotificationEvent } from './NotificationEvent'

/** Notifications about organization membership. */
export class MemberNotifications {
  /**
   * Tell an existing user they were invited, so they can accept in the dashboard.
   *
   * @param invitation
   * @param inviterId
   */
  async invited(invitation: OrganizationInvitation, inviterId: string | null): Promise<void> {
    const [invitee, organization, role] = await Promise.all([
      User.where({ email: invitation.email })
        .first()
        .catch(() => null),
      Organization.where({ id: invitation.organizationId })
        .first()
        .catch(() => null),
      Role.where({ id: invitation.roleId })
        .first()
        .catch(() => null),
    ])
    if (!invitee) return

    const organizationName = organization?.name ?? 'an organization'

    await NotificationEvent.make(NOTIFICATION_TYPE.invitationReceived)
      .to([invitee.id])
      .by(inviterId)
      .about({
        title: `Invitation to ${organizationName}`,
        description: `You were invited to join ${organizationName}${role ? ` as ${role.name}` : ''}.`,
        actionText: 'View invitation',
        actionLink: '/invitations',
        meta: { invitation_id: invitation.id, organization_id: invitation.organizationId },
        tag: `invitation:${invitation.id}`,
      })
      .dispatchSafely()
  }
}

/** Shared singleton. */
export const memberNotifications = new MemberNotifications()
