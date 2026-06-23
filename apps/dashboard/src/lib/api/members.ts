import type { PermissionKey } from '@arkyc/types'
import { CACHE, type Paginated, alova, params, t, unwrap } from './client'
import type { MemberPermissions, MemberWithRelations } from './types'

/** Organization members, role assignment, and direct permission grants. */
export class Members {
  /**
   * Paginated member list (eager user + role). Pass `page`/`limit`
   * (usePagination supplies these); list views consume it via infinite scroll.
   */
  static list(organizationId: string, query?: { page?: number; limit?: number }) {
    return alova.Get<Paginated<MemberWithRelations>>(`${t(organizationId)}/members`, {
      name: 'members:list',
      cacheFor: CACHE,
      hitSource: ['member:invite', 'member:assignRole'],
      params: params(query),
    })
  }

  /** A single member (eager user + role) — for the member detail page. */
  static get(organizationId: string, memberId: string) {
    return alova.Get(`${t(organizationId)}/members/${memberId}`, {
      name: 'member:detail',
      cacheFor: CACHE,
      hitSource: ['member:assignRole'],
      transform: unwrap<MemberWithRelations>,
    })
  }

  /** A member's role/direct/effective permissions. */
  static permissions(organizationId: string, memberId: string) {
    return alova.Get(`${t(organizationId)}/members/${memberId}/permissions`, {
      name: 'member:permissions',
      cacheFor: CACHE,
      hitSource: ['member:addPermission', 'member:removePermission'],
      transform: unwrap<MemberPermissions>,
    })
  }

  /** Invite a user by email to a role (issues a one-time token). */
  static invite(organizationId: string, input: { email: string; role_id: string }) {
    return alova.Post<unknown>(`${t(organizationId)}/invitations`, input, { name: 'member:invite' })
  }

  /** Reassign a member's role. */
  static assignRole(organizationId: string, memberId: string, input: { role_id: string }) {
    return alova.Patch<unknown>(`${t(organizationId)}/members/${memberId}`, input, {
      name: 'member:assignRole',
    })
  }

  /** Grant a direct permission to a member. */
  static addPermission(organizationId: string, memberId: string, input: { permission: PermissionKey }) {
    return alova.Post<unknown>(`${t(organizationId)}/members/${memberId}/permissions`, input, {
      name: 'member:addPermission',
    })
  }

  /** Revoke a direct permission from a member. */
  static removePermission(organizationId: string, memberId: string, permission: PermissionKey) {
    return alova.Delete<unknown>(`${t(organizationId)}/members/${memberId}/permissions/${permission}`, undefined, {
      name: 'member:removePermission',
    })
  }
}
