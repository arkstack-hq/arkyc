import type { PermissionKey } from '@arkyc/types'
import { CACHE, type Paginated, alova, params, t, unwrap } from './client'
import type { MemberPermissions, MemberWithRelations } from './types'

/** Tenant members, role assignment, and direct permission grants. */
export class Members {
  /**
   * Paginated member list (eager user + role). Pass `page`/`limit`
   * (usePagination supplies these); list views consume it via infinite scroll.
   */
  static list(tenantId: string, query?: { page?: number; limit?: number }) {
    return alova.Get<Paginated<MemberWithRelations>>(`${t(tenantId)}/members`, {
      name: 'members:list',
      cacheFor: CACHE,
      hitSource: ['member:invite', 'member:assignRole'],
      params: params(query),
    })
  }

  /** A single member (eager user + role) — for the member detail page. */
  static get(tenantId: string, memberId: string) {
    return alova.Get(`${t(tenantId)}/members/${memberId}`, {
      name: 'member:detail',
      cacheFor: CACHE,
      hitSource: ['member:assignRole'],
      transform: unwrap<MemberWithRelations>,
    })
  }

  /** A member's role/direct/effective permissions. */
  static permissions(tenantId: string, memberId: string) {
    return alova.Get(`${t(tenantId)}/members/${memberId}/permissions`, {
      name: 'member:permissions',
      cacheFor: CACHE,
      hitSource: ['member:addPermission', 'member:removePermission'],
      transform: unwrap<MemberPermissions>,
    })
  }

  /** Invite a user by email to a role (issues a one-time token). */
  static invite(tenantId: string, input: { email: string; role_id: string }) {
    return alova.Post<unknown>(`${t(tenantId)}/invitations`, input, { name: 'member:invite' })
  }

  /** Reassign a member's role. */
  static assignRole(tenantId: string, memberId: string, input: { role_id: string }) {
    return alova.Patch<unknown>(`${t(tenantId)}/members/${memberId}`, input, {
      name: 'member:assignRole',
    })
  }

  /** Grant a direct permission to a member. */
  static addPermission(tenantId: string, memberId: string, input: { permission: PermissionKey }) {
    return alova.Post<unknown>(`${t(tenantId)}/members/${memberId}/permissions`, input, {
      name: 'member:addPermission',
    })
  }

  /** Revoke a direct permission from a member. */
  static removePermission(tenantId: string, memberId: string, permission: PermissionKey) {
    return alova.Delete<unknown>(`${t(tenantId)}/members/${memberId}/permissions/${permission}`, undefined, {
      name: 'member:removePermission',
    })
  }
}
