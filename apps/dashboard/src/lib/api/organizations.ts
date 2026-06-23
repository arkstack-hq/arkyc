import type { Organization, OrganizationSettings } from '@arkyc/types'
import { CACHE, alova, t, unwrap } from './client'
import type { MemberPermissions } from './types'

/** Organizations the user belongs to, plus the active organization's effective permissions. */
export class Organizations {
  /** List the organizations the current user is a member of. */
  static list() {
    return alova.Get('/v1/dashboard/organizations', {
      name: 'organizations:list',
      cacheFor: CACHE,
      hitSource: ['organization:create', 'organization:update'],
      transform: unwrap<Organization[]>,
    })
  }

  /** Show a single organization. */
  static get(organizationId: string) {
    return alova.Get(t(organizationId), {
      name: 'organization:detail',
      cacheFor: CACHE,
      hitSource: ['organization:update'],
      transform: unwrap<Organization>,
    })
  }

  /** Create a new organization (onboarding); the creator becomes its owner. */
  static create(input: { name: string }) {
    return alova.Post('/v1/dashboard/organizations', input, {
      name: 'organization:create',
      transform: unwrap<Organization>,
    })
  }

  /** Update organization name/settings. */
  static update(organizationId: string, input: { name?: string; settings?: OrganizationSettings }) {
    return alova.Patch(t(organizationId), input, {
      name: 'organization:update',
      transform: unwrap<Organization>,
    })
  }

  /** The current user's role/direct/effective permissions in this organization. */
  static me(organizationId: string) {
    return alova.Get(`${t(organizationId)}/me`, {
      name: 'organization:me',
      cacheFor: CACHE,
      hitSource: ['member:assignRole', 'member:addPermission', 'member:removePermission', 'role:update'],
      transform: unwrap<MemberPermissions>,
    })
  }
}
