import { BaseController } from '@controllers/BaseController'
import EmptyResource from '@app/http/resources/EmptyResource'
import { HttpContext } from 'clear-router/types/express'
import InvitationResource from '@app/http/resources/InvitationResource'
import MemberCollection from '@app/http/resources/MemberCollection'
import MemberResource from '@app/http/resources/MemberResource'
import MemberPermissionsResource from '@app/http/resources/MemberPermissionsResource'
import { Permission } from '@app/models/Permission'
import type { QueryBuilder } from 'arkormx'
import { RequestException, perPage } from '@arkstack/common'
import { Role } from '@app/models/Role'
import { OrganizationInvitation } from '@app/models/OrganizationInvitation'
import { OrganizationMember } from '@app/models/OrganizationMember'
import { UserPermission } from '@app/models/UserPermission'
import { Token } from '@arkyc/auth'
import { toArray } from 'src/support/collection'
import { audit } from '@app/services/AuditLogger'

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000

export default class MemberController extends BaseController {
  /**
   * List organization members with their user + role eager-loaded (no N+1).
   *
   * @param   ctx  The HTTP context (`req.organization`).
   * @returns      A MemberCollection.
   */
  async index({ req }: HttpContext) {
    const members = await OrganizationMember.where({ organizationId: req.organization!.id })
      .with(['user', 'role'])
      .paginate(perPage(req.query))

    return new MemberCollection(members).additional({
      status: 'success',
      message: 'OK',
      code: 200,
    })
  }

  /**
   * Show a single member (with user + role) in the active organization. Lets the
   * member detail page resolve one member without fetching the paginated list.
   *
   * @param   ctx  The HTTP context (`:memberId`, `req.organization`).
   * @returns      A MemberResource.
   */
  async show({ req }: HttpContext) {
    const member = await OrganizationMember.where({
      id: req.params.memberId,
      organizationId: req.organization!.id,
    })
      .with(['user', 'role'])
      .firstOrFail()

    return new MemberResource(member).additional({
      status: 'success',
      message: 'OK',
      code: 200,
    })
  }

  /**
   * Resolve the authenticated user's own role/direct/effective permissions in
   * the active organization. Open to any member (no `can()` guard) so the dashboard can
   * render permission-aware navigation regardless of the user's role.
   *
   * @param   ctx  The HTTP context (`req.organization`, `req.user`).
   * @returns      A Resource of the caller's role/direct/effective permissions.
   */
  async me({ req }: HttpContext) {
    const member = await OrganizationMember.where({ userId: req.user!.id, organizationId: req.organization!.id })
      .with({
        role: (q) => q.with('permissions'),
        user: (q) =>
          q.with({
            directPermissions: (d: QueryBuilder<UserPermission>) =>
              d.where({ organizationId: req.organization!.id }).whereNull('projectId').with('permission'),
          }),
      })
      .firstOrFail()

    const role = member.getAttribute('role')
    const user = member.getAttribute('user')!

    const role_permissions = toArray(role?.getAttribute('permissions')).map((p) => p?.getAttribute('name'))
    const direct_permissions = toArray(user.getAttribute('directPermissions') as any)
      .map((up: any) => (up?.getAttribute('permission') as any)?.getAttribute('name'))
      .filter(Boolean)
    const effective_permissions = [...new Set([...role_permissions, ...direct_permissions])]

    return new MemberPermissionsResource({
      roleId: member.roleId,
      rolePermissions: role_permissions,
      directPermissions: direct_permissions,
      effectivePermissions: effective_permissions,
    }).additional({
      status: 'success',
      message: 'OK',
      code: 200,
    })
  }

  /**
   * Invite an email address to the organization with a role (one-time token).
   *
   * @param   ctx  The HTTP context (`req.organization`).
   * @returns      An InvitationResource plus the one-time `token` (HTTP 201).
   */
  async invite({ req }: HttpContext) {
    const data = await this.validate({
      email: ['required', 'email'],
      role_id: ['required', 'string'],
    })

    const role = await Role.where({ id: data.role_id, organizationId: req.organization!.id }).first()
    RequestException.assertFound(role, 'role_id is not a role of this organization', 422)

    const { token, tokenHash } = Token.createPair()
    const invitation = await OrganizationInvitation.create({
      organizationId: req.organization!.id,
      email: data.email,
      roleId: role.id,
      tokenHash,
      expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
    })

    await audit.recordForRequest(req, {
      action: 'member.invited',
      entityType: 'organization_invitation',
      entityId: invitation.id,
      metadata: { email: data.email },
    })

    // The raw token is returned once so it can be delivered to the invitee.
    return new InvitationResource(invitation)
      .additional({
        status: 'success',
        message: 'Invitation created',
        code: 201,
        token,
      })
      .response()
      .setStatusCode(201)
  }

  /**
   * Resolve a member's role, direct, and effective permissions.
   *
   * @param   ctx  The HTTP context (`:memberId`, `req.organization`).
   * @returns      A Resource of role/direct/effective permissions.
   */
  async showPermissions({ req }: HttpContext) {
    const member = await OrganizationMember.where({ id: req.params.memberId, organizationId: req.organization!.id })
      .with({
        role: (q) => q.with('permissions'),
        user: (q) =>
          q.with({
            directPermissions: (d: QueryBuilder<UserPermission>) =>
              d.where({ organizationId: req.organization!.id }).whereNull('projectId').with('permission'),
          }),
      })
      .firstOrFail()

    const role = member.getAttribute('role')
    const user = member.getAttribute('user')!

    const role_permissions = toArray(role?.getAttribute('permissions')).map((p) => p?.getAttribute('name'))

    const direct_permissions = toArray(user.getAttribute('directPermissions') as any)
      .map((up: any) => (up?.getAttribute('permission') as any)?.getAttribute('name'))
      .filter(Boolean)
    // effective = role + direct (no project context here); matches Permissions.resolve().
    const effective_permissions = [...new Set([...role_permissions, ...direct_permissions])]

    return new MemberPermissionsResource({
      roleId: member.roleId,
      rolePermissions: role_permissions,
      directPermissions: direct_permissions,
      effectivePermissions: effective_permissions,
    }).additional({
      status: 'success',
      message: 'OK',
      code: 200,
    })
  }

  /**
   * Assign a different role to a member.
   *
   * @param   ctx  The HTTP context (`:memberId`, `req.organization`).
   * @returns      An EmptyResource.
   */
  async assignRole({ req }: HttpContext) {
    const member = await OrganizationMember.where({
      id: req.params.memberId,
      organizationId: req.organization!.id,
    }).firstOrFail()
    const data = await this.validate({ role_id: ['required', 'string'] })

    const role = await Role.where({ id: data.role_id, organizationId: req.organization!.id }).first()
    RequestException.assertFound(role, 'role_id is not a role of this organization', 422)

    member.roleId = role.id
    await member.save()

    await audit.recordForRequest(req, {
      action: 'member.role_assigned',
      entityType: 'organization_member',
      entityId: member.id,
      metadata: { roleId: role.id },
    })

    return new EmptyResource({}).additional({
      status: 'success',
      message: 'Role assigned',
      code: 200,
    })
  }

  /**
   * Grant a direct (organization-level) permission to a member.
   *
   * @param   ctx  The HTTP context (`:memberId`, `req.organization`).
   * @returns      An EmptyResource.
   */
  async addPermission({ req }: HttpContext) {
    const member = await OrganizationMember.where({
      id: req.params.memberId,
      organizationId: req.organization!.id,
    }).firstOrFail()
    const data = await this.validate({
      permission: ['required', 'string', 'exists:permissions,name'],
    })

    // `exists` already 422s on an unknown permission; fetch it for its id.
    // Platform-admin permissions belong to the `/admin` scope, never an organization member.
    const perm = await Permission.where({ name: data.permission, admin: false }).first()
    RequestException.assertFound(perm, 'Unknown permission', 422)

    await UserPermission.query().firstOrCreate(
      { organizationId: member.organizationId, userId: member.userId, permissionId: perm.id },
      { projectId: null },
    )

    await audit.recordForRequest(req, {
      action: 'member.permission_granted',
      entityType: 'organization_member',
      entityId: member.id,
      metadata: { permission: data.permission },
    })

    return new EmptyResource({}).additional({
      status: 'success',
      message: 'Permission granted',
      code: 200,
    })
  }

  /**
   * Revoke a member's direct permission.
   *
   * @param   ctx  The HTTP context (`:memberId`, `:permission`, `req.organization`).
   * @returns      An EmptyResource.
   */
  async removePermission({ req }: HttpContext) {
    const member = await OrganizationMember.where({
      id: req.params.memberId,
      organizationId: req.organization!.id,
    }).firstOrFail()
    const name = req.params.permission

    const perm = await Permission.where({ name }).firstOrFail()

    const grant = await UserPermission.where({
      organizationId: member.organizationId,
      userId: member.userId,
      permissionId: perm.id,
    }).first()
    if (grant) await grant.delete()

    await audit.recordForRequest(req, {
      action: 'member.permission_revoked',
      entityType: 'organization_member',
      entityId: member.id,
      metadata: { permission: name },
    })

    return new EmptyResource({}).additional({
      status: 'success',
      message: 'Permission revoked',
      code: 200,
    })
  }
}
