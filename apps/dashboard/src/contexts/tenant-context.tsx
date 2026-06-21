import type { PermissionKey, Tenant } from '@arkyc/types'
import { createContext, useContext, useMemo } from 'react'
import { useRequest, useWatcher } from 'alova/client'

import type { ReactNode } from 'react'
import { Tenants } from '@/lib/api'
import { useParams } from 'react-router-dom'

interface TenantState {
  tenant: Tenant | null
  tenants: Tenant[]
  permissions: PermissionKey[]
  /** Whether the current user holds `permission` in the active tenant. */
  can: (permission: PermissionKey) => boolean
  loading: boolean
  notFound: boolean
}

const TenantContext = createContext<TenantState | null>(null)

/** Lists the user's tenants; exposes the active one (by `:tenantSlug`) + permissions. */
export function TenantProvider({ children }: { children: ReactNode }) {
  const { tenantSlug } = useParams()

  const { data: tenants, loading: tenantsLoading } = useRequest(Tenants.list(), {
    initialData: [],
  })

  const tenant = useMemo(
    () => tenants.find((x) => x.slug === tenantSlug) ?? null,
    [tenants, tenantSlug],
  )

  // Effective permissions depend on the active tenant id (reactive state).
  const { data: me, loading: meLoading } = useWatcher(() => Tenants.me(tenant!.id), [tenant?.id], {
    immediate: false,
  })

  const value = useMemo<TenantState>(() => {
    const permissions = (tenant ? (me?.effective_permissions ?? []) : []) as PermissionKey[]
    const set = new Set(permissions)
    return {
      tenant,
      tenants,
      permissions,
      can: (permission) => set.has(permission),
      loading: tenantsLoading || (!!tenant && meLoading && !me),
      notFound: !tenantsLoading && !!tenantSlug && !tenant,
    }
  }, [tenant, tenants, me, tenantsLoading, meLoading, tenantSlug])

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

export function useTenant(): TenantState {
  const ctx = useContext(TenantContext)
  if (!ctx) throw new Error('useTenant must be used within a TenantProvider')
  return ctx
}

/** Convenience hook: the active tenant id (throws if no active tenant). */
export function useTenantId(): string {
  const { tenant } = useTenant()
  if (!tenant) throw new Error('No active tenant')
  return tenant.id
}
