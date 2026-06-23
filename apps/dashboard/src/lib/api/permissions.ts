import type { Permission } from '@arkyc/types'
import { CACHE, alova, t, unwrap } from './client'

/** The permission catalogue recognised by Arkyc (static reference data). */
export class Permissions {
  /** List every known permission. */
  static list(organizationId: string) {
    return alova.Get(`${t(organizationId)}/permissions`, {
      name: 'permissions:list',
      cacheFor: CACHE,
      transform: unwrap<Permission[]>,
    })
  }
}
