import { RequestException } from '@arkstack/common'
import type { QueryBuilder } from 'arkormx'
import { OrganizationInvitation } from '@app/models/OrganizationInvitation'
import { OrganizationMember } from '@app/models/OrganizationMember'
import type { User } from '@app/models/User'

/** Accepting organization invitations, by link token or in-app. */
export class InvitationService {
  /**
   * Unaccepted, unexpired invitations addressed to the user's email.
   *
   * @param user
   * @returns
   */
  pendingFor(user: User): QueryBuilder<OrganizationInvitation> {
    return OrganizationInvitation.query()
      .where({ email: user.email })
      .whereNull('acceptedAt')
      .where('expiresAt', '>', new Date()) as unknown as QueryBuilder<OrganizationInvitation>
  }

  /**
   * Join the invitation's organization as the user.
   *
   * @param invitation
   * @param user
   */
  async accept(invitation: OrganizationInvitation, user: User): Promise<void> {
    RequestException.abortIf(new Date(invitation.expiresAt).getTime() <= Date.now(), 'Invitation has expired', 410)
    RequestException.abortIf(invitation.email !== user.email, 'This invitation is for a different email', 403)

    await OrganizationMember.query().firstOrCreate(
      { userId: user.id, organizationId: invitation.organizationId },
      {
        roleId: invitation.roleId,
        status: 'active',
        joinedAt: new Date(),
      },
    )

    invitation.acceptedAt = new Date()
    await invitation.save()
  }
}

/** Shared singleton. */
export const invitations = new InvitationService()
