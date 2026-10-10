import { Permission } from '@app/models/Permission'
import type { PermissionKey } from '@arkyc/types'
import type { QueryBuilder } from 'arkormx'
import { Role } from '@app/models/Role'
import { RolePermission } from '@app/models/RolePermission'
import { User } from '@app/models/User'
import type { VerificationSession } from '@app/models/VerificationSession'
import { toArray } from 'src/support/collection'

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
   * Users holding `permission` in the organization, optionally on a project.
   *
   * Relation filters are kept one level deep so they compile to SQL: the
   * organization's roles that grant the permission are resolved first.
   *
   * @param permission
   * @param organizationId
   * @param projectId
   * @returns
   */
  static async withPermission(
    permission: PermissionKey,
    organizationId: string,
    projectId?: string | null,
  ): Promise<Query> {
    const permissionId = (await Permission.where({ name: permission }).first())?.id ?? null
    const orgRoleIds = toArray(await Role.where({ organizationId }).pluck('id')) as string[]
    const roleIds =
      permissionId && orgRoleIds.length
        ? (toArray(
            await RolePermission.where({ permissionId }).whereIn('roleId', orgRoleIds).pluck('roleId'),
          ) as string[])
        : []

    // An impossible id keeps the query valid when no role grants the permission.
    const grantingRoles = roleIds.length ? roleIds : ['00000000-0000-0000-0000-000000000000']

    const query = (User.query() as unknown as Query).whereHas('organizationMembers', (member: RelationQuery) =>
      member.where({ organizationId, status: 'active' }).whereIn('roleId', grantingRoles),
    )

    const withProject = projectId
      ? query.orWhereHas('projectMemberships', (member: RelationQuery) =>
          member.where({ projectId, status: 'active' }).whereIn('roleId', grantingRoles),
        )
      : query

    if (!permissionId) return withProject

    return withProject.orWhereHas('directPermissions', (grant: RelationQuery) =>
      grant
        .where({ organizationId, permissionId })
        .where((scope: RelationQuery) =>
          projectId ? scope.whereNull('projectId').orWhere({ projectId }) : scope.whereNull('projectId'),
        ),
    )
  }
}
