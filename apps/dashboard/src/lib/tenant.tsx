import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import type { PermissionKey, Tenant } from '@arkyc/types'
import { api } from './api'

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

  const tenantsQuery = useQuery({ queryKey: ['tenants'], queryFn: api.tenants.list })
  const tenants = tenantsQuery.data ?? []
  const tenant = useMemo(
    () => tenants.find((x) => x.slug === tenantSlug) ?? null,
    [tenants, tenantSlug],
  )

  const meQuery = useQuery({
    queryKey: ['tenant-me', tenant?.id],
    queryFn: () => api.tenants.me(tenant!.id),
    enabled: !!tenant,
  })

  const permissions = meQuery.data?.effective_permissions ?? []

  const value = useMemo<TenantState>(() => {
    const set = new Set(permissions)
    return {
      tenant,
      tenants,
      permissions,
      can: (permission) => set.has(permission),
      loading: tenantsQuery.isLoading || (!!tenant && meQuery.isLoading),
      notFound: tenantsQuery.isSuccess && !tenant,
    }
  }, [
    tenant,
    tenants,
    permissions,
    tenantsQuery.isLoading,
    tenantsQuery.isSuccess,
    meQuery.isLoading,
  ])

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
