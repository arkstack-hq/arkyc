import type { Tenant, TenantSettings } from '@arkyc/types'
import { CACHE, alova, t, unwrap } from './client'
import type { MemberPermissions } from './types'

/** Tenants the user belongs to, plus the active tenant's effective permissions. */
export class Tenants {
  /** List the tenants the current user is a member of. */
  static list() {
    return alova.Get('/v1/dashboard/tenants', {
      name: 'tenants:list',
      cacheFor: CACHE,
      hitSource: ['tenant:create', 'tenant:update'],
      transform: unwrap<Tenant[]>,
    })
  }

  /** Show a single tenant. */
  static get(tenantId: string) {
    return alova.Get(t(tenantId), {
      name: 'tenant:detail',
      cacheFor: CACHE,
      hitSource: ['tenant:update'],
      transform: unwrap<Tenant>,
    })
  }

  /** Create a new tenant (onboarding); the creator becomes its owner. */
  static create(input: { name: string }) {
    return alova.Post('/v1/dashboard/tenants', input, {
      name: 'tenant:create',
      transform: unwrap<Tenant>,
    })
  }

  /** Update tenant name/settings. */
  static update(tenantId: string, input: { name?: string; settings?: TenantSettings }) {
    return alova.Patch(t(tenantId), input, {
      name: 'tenant:update',
      transform: unwrap<Tenant>,
    })
  }

  /** The current user's role/direct/effective permissions in this tenant. */
  static me(tenantId: string) {
    return alova.Get(`${t(tenantId)}/me`, {
      name: 'tenant:me',
      cacheFor: CACHE,
      hitSource: [
        'member:assignRole',
        'member:addPermission',
        'member:removePermission',
        'role:update',
      ],
      transform: unwrap<MemberPermissions>,
    })
  }
}
