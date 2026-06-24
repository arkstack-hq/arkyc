import type { PermissionKey, Organization } from '@arkyc/types'
import { createContext, useContext, useMemo } from 'react'
import { useRequest, useWatcher } from 'alova/client'

import type { ReactNode } from 'react'
import { Organizations } from '@/lib/api'
import { useParams } from 'react-router-dom'

interface OrganizationState {
  organization: Organization | null
  organizations: Organization[]
  permissions: PermissionKey[]
  /** Whether the current user holds `permission` in the active organization. */
  can: (permission: PermissionKey) => boolean
  loading: boolean
  notFound: boolean
}

const OrganizationContext = createContext<OrganizationState | null>(null)

/** Lists the user's organizations; exposes the active one (by `:organizationSlug`) + permissions. */
export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { organizationSlug } = useParams()

  const { data: organizations, loading: organizationsLoading } = useRequest(Organizations.list(), {
    initialData: [],
  })

  const organization = useMemo(
    () => organizations.find((x) => x.slug === organizationSlug) ?? null,
    [organizations, organizationSlug],
  )

  // Effective permissions depend on the active organization id (reactive state).
  // `immediate` must be true when an organization is already resolved on mount (warm
  // cache after login) — otherwise the watcher only fires on a later change,
  // which never comes, and permissions stay empty until a hard refresh.
  const { data: me, loading: meLoading } = useWatcher(() => Organizations.me(organization!.id), [organization?.id], {
    immediate: !!organization,
  })

  const value = useMemo<OrganizationState>(() => {
    const permissions = (organization ? (me?.effective_permissions ?? []) : []) as PermissionKey[]
    const set = new Set(permissions)
    return {
      organization,
      organizations,
      permissions,
      can: (permission) => set.has(permission),
      loading: organizationsLoading || (!!organization && meLoading && !me),
      notFound: !organizationsLoading && !!organizationSlug && !organization,
    }
  }, [organization, organizations, me, organizationsLoading, meLoading, organizationSlug])

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>
}

export function useOrganization(): OrganizationState {
  const ctx = useContext(OrganizationContext)
  if (!ctx) throw new Error('useOrganization must be used within a OrganizationProvider')
  return ctx
}

/** Convenience hook: the active organization id (throws if no active organization). */
export function useOrganizationId(): string {
  const { organization } = useOrganization()
  if (!organization) throw new Error('No active organization')
  return organization.id
}
