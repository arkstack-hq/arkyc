import type { AdminPermissionKey } from '@arkyc/types'
import { useRequest } from 'alova/client'
import { Admin } from '@/lib/api'

interface AdminAccess {
  isAdmin: boolean
  /** Whether the current user holds `permission` in the platform-admin scope. */
  can: (permission: AdminPermissionKey) => boolean
  loading: boolean
}

/**
 * The current user's platform-admin standing, from `GET /v1/admin/me`. Returns
 * `isAdmin: false` for ordinary users. Cached by alova, so calling it in both the
 * organization topbar and the admin layout issues a single request.
 */
export function useAdmin(): AdminAccess {
  const { data, loading } = useRequest(Admin.me(), {
    initialData: { is_admin: false, permissions: [] as AdminPermissionKey[] },
  })

  const set = new Set(data.permissions)

  return {
    isAdmin: data.is_admin,
    can: (permission) => set.has(permission),
    loading,
  }
}
