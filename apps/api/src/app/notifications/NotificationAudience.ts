import type { PermissionKey } from '@arkyc/types'
import type { QueryBuilder } from 'arkormx'
import { User } from '@app/models/User'
import type { VerificationSession } from '@app/models/VerificationSession'

type Query = QueryBuilder<User>
type RelationQuery = QueryBuilder<any, any>

/**
 * Database-side recipient queries for notification events. Each returns a user
 * query for {@link NotificationEvent.toAudience}, so audiences are never loaded
 * whole into memory.
 */
export class NotificationAudience {
  /**
   * Members who may act on the session's review: through their organization
   * role, their role on the session's project, or a direct grant.
   *
   * @param session
   * @returns
   */
  static async sessionReviewers(session: VerificationSession): Promise<Query> {
    return this.withPermission('reviews.view', session.organizationId, session.projectId)
  }

  /**
   * Active organization members holding `permission`, optionally on a project.
   *
   * @param permission
   * @param organizationId
   * @param projectId
   * @returns
   */
  static withPermission(permission: PermissionKey, organizationId: string, projectId?: string | null): Query {
    const grantsPermission = (query: RelationQuery) =>
      query.whereHas('role', (role: RelationQuery) =>
        role.whereHas('rolePermissions', (grant: RelationQuery) =>
          grant.whereHas('permission', (perm: RelationQuery) => perm.where({ name: permission })),
        ),
      )

    return (User.query() as unknown as Query)
      .whereHas('organizationMembers', (member: RelationQuery) => member.where({ organizationId, status: 'active' }))
      .where((query: Query) => {
        query.whereHas('organizationMembers', (member: RelationQuery) =>
          grantsPermission(member.where({ organizationId })),
        )

        if (projectId) {
          query.orWhereHas('projectMemberships', (member: RelationQuery) =>
            grantsPermission(member.where({ projectId, status: 'active' })),
          )
        }

        query.orWhereHas('directPermissions', (grant: RelationQuery) =>
          grant
            .where({ organizationId })
            .where((scope: RelationQuery) =>
              projectId ? scope.whereNull('projectId').orWhere({ projectId }) : scope.whereNull('projectId'),
            )
            .whereHas('permission', (perm: RelationQuery) => perm.where({ name: permission })),
        )
      })
  }
}
