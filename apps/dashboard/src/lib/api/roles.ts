import type { Role } from '@arkyc/types'
import { CACHE, type Paginated, alova, params, t, unwrap } from './client'
import type { CreateRoleInput, RoleWithPermissions } from './types'

/** Large page size for "fetch all" picker/dropdown calls. */
const PICKER_LIMIT = 200

/** Organization roles and their permission sets. */
export class Roles {
  /**
   * Paginated role list. Pass `page`/`limit` (usePagination supplies these);
   * the roles list view consumes it via infinite scroll.
   */
  static list(organizationId: string, query?: { page?: number; limit?: number }) {
    return alova.Get<Paginated<RoleWithPermissions>>(`${t(organizationId)}/roles`, {
      name: 'roles:list',
      cacheFor: CACHE,
      hitSource: ['role:create', 'role:update'],
      params: params(query),
    })
  }

  /** All roles in one shot, for role-picker dropdowns (simple-data fetch). */
  static options(organizationId: string) {
    return alova.Get(`${t(organizationId)}/roles`, {
      name: 'roles:options',
      cacheFor: CACHE,
      hitSource: ['role:create', 'role:update'],
      params: { limit: String(PICKER_LIMIT) },
      transform: unwrap<RoleWithPermissions[]>,
    })
  }

  /** Show a role with its permissions. */
  static get(organizationId: string, roleId: string) {
    return alova.Get(`${t(organizationId)}/roles/${roleId}`, {
      name: 'role:detail',
      cacheFor: CACHE,
      hitSource: ['role:update'],
      transform: unwrap<RoleWithPermissions>,
    })
  }

  /** Create a custom role. */
  static create(organizationId: string, input: CreateRoleInput) {
    return alova.Post(`${t(organizationId)}/roles`, input, {
      name: 'role:create',
      transform: unwrap<Role>,
    })
  }

  /** Update a role's details and permission set. */
  static update(organizationId: string, roleId: string, input: Partial<CreateRoleInput>) {
    return alova.Patch(`${t(organizationId)}/roles/${roleId}`, input, {
      name: 'role:update',
      transform: unwrap<Role>,
    })
  }
}
