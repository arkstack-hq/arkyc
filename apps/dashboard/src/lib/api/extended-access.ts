import type { AccessCapability, AccessGrantDetails, AccessGrantStatus } from '@arkyc/types'
import { CACHE, type Paginated, alova, p, params, unwrap } from './client'

export type { AccessCapability, AccessGrantStatus } from '@arkyc/types'

interface ActorRef {
  id: string
  name: string
  email: string
}

/** A project's extended-access grant for one capability. Nested refs only on the admin surface. */
export interface AccessGrant {
  id: string | null
  organization_id: string
  project_id: string
  capability: AccessCapability
  status: AccessGrantStatus
  details: AccessGrantDetails | null
  note: string | null
  requested_by: string | null
  requested_at: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string | null
  updated_at: string | null
  project?: { id: string; name: string } | null
  organization?: { id: string; name: string } | null
  requester?: ActorRef | null
  reviewer?: ActorRef | null
}

/** The PII request detail an owner submits alongside the `pii` capability. */
export interface PiiRequest {
  categories: NonNullable<AccessGrantDetails['categories']>
  timing: NonNullable<AccessGrantDetails['timing']>
  justification: string
}

/** Admin organization detail: core fields + headline counts (projects fetched separately). */
export interface AdminOrganizationDetail {
  id: string
  name: string
  slug: string
  logo_url: string | null
  created_at: string
  counts: { projects: number; members: number; sessions: number }
}

/** Per-capability status summary on an admin project row. */
type CapabilityStatus = { status: AccessGrantStatus; requested_at: string | null; reviewed_at: string | null }

/** A project row in the admin organization view, carrying its extended-access status per capability. */
export interface AdminProject {
  id: string
  name: string
  environment: string
  status: string
  extended_access: Record<AccessCapability, CapabilityStatus>
}

interface AdminListParams {
  status?: AccessGrantStatus
  capability?: AccessCapability
  page?: number
  limit?: number
}

const ON_DECISION = ['extended_access:request', 'extended_access:admin:grant', 'extended_access:admin:revoke']

/**
 * Extended access: gated project capabilities (`ai`, `pii`). Project owners read
 * their per-capability status and request capabilities; platform admins list,
 * review, grant, and revoke each. Server-gated by `projects.*` (owner) and
 * `admin.extended_access.*` (admin).
 */
export class ExtendedAccess {
  /** The project's grants for every capability (synthetic `none` when never requested). */
  static status(organizationId: string, projectId: string) {
    return alova.Get(`${p(organizationId, projectId)}/extended-access`, {
      name: 'extended_access:status',
      cacheFor: CACHE,
      hitSource: ON_DECISION,
      transform: unwrap<AccessGrant[]>,
    })
  }

  /** Request one or more capabilities for the project (PII carries its detail). */
  static request(organizationId: string, projectId: string, capabilities: AccessCapability[], pii?: PiiRequest) {
    return alova.Post(
      `${p(organizationId, projectId)}/extended-access/request`,
      { capabilities, pii },
      { name: 'extended_access:request', transform: unwrap<AccessGrant[]> },
    )
  }

  /** Paginated grants across every organization (admin), newest first. */
  static list(query?: AdminListParams) {
    return alova.Get<Paginated<AccessGrant>>('/v1/admin/extended-access', {
      name: 'admin:extended_access',
      cacheFor: CACHE,
      hitSource: ['extended_access:admin:grant', 'extended_access:admin:revoke'],
      params: params(query as Record<string, unknown>),
    })
  }

  /** A single project's grants across every capability (dedicated review page). */
  static project(projectId: string) {
    return alova.Get(`/v1/admin/extended-access/projects/${projectId}`, {
      name: 'admin:extended_access:project',
      cacheFor: CACHE,
      hitSource: ['extended_access:admin:grant', 'extended_access:admin:revoke'],
      transform: (envelope: {
        data?: AccessGrant[]
        project?: { id: string; name: string; organization_id: string }
      }) => ({
        grants: envelope.data ?? [],
        project: envelope.project ?? null,
      }),
    })
  }

  /** Count of pending requests (drives the nav badge). */
  static pendingCount() {
    return alova.Get('/v1/admin/extended-access/count', {
      name: 'admin:extended_access:count',
      cacheFor: CACHE,
      hitSource: ['extended_access:admin:grant', 'extended_access:admin:revoke', 'extended_access:request'],
      params: params({ status: 'pending' }),
      transform: (envelope: { data?: { count: number } }) => envelope.data?.count ?? 0,
    })
  }

  /** Grant a capability to a project (approve a request, or grant directly). */
  static grant(projectId: string, capability: AccessCapability) {
    return alova.Post(
      '/v1/admin/extended-access/grant',
      { project_id: projectId, capability },
      { name: 'extended_access:admin:grant', transform: unwrap<AccessGrant> },
    )
  }

  /** Revoke a capability from a project. */
  static revoke(projectId: string, capability: AccessCapability) {
    return alova.Post(
      '/v1/admin/extended-access/revoke',
      { project_id: projectId, capability },
      { name: 'extended_access:admin:revoke', transform: unwrap<AccessGrant> },
    )
  }

  /** Admin organization detail (core fields + counts). */
  static organization(organizationId: string) {
    return alova.Get(`/v1/admin/organizations/${organizationId}`, {
      name: 'admin:organization:detail',
      cacheFor: CACHE,
      transform: unwrap<AdminOrganizationDetail>,
    })
  }

  /** Paginated projects for an organization (admin), each with its extended-access status. */
  static organizationProjects(organizationId: string, query?: { page?: number; limit?: number }) {
    return alova.Get<Paginated<AdminProject>>(`/v1/admin/organizations/${organizationId}/projects`, {
      name: 'admin:organization:projects',
      cacheFor: CACHE,
      hitSource: ['extended_access:admin:grant', 'extended_access:admin:revoke'],
      params: params(query as Record<string, unknown>),
    })
  }
}
