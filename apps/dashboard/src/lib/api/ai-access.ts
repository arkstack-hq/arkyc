import { CACHE, type Paginated, alova, p, params, unwrap } from './client'

/** Lifecycle of a project's AI document-processing access. */
export type AiAccessStatus = 'none' | 'pending' | 'granted' | 'revoked'

interface ActorRef {
  id: string
  name: string
  email: string
}

/** A project's AI-processing access record. Nested refs only on the admin surface. */
export interface AiAccessGrant {
  id: string | null
  organization_id: string
  project_id: string
  status: AiAccessStatus
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

/** Admin organization detail: core fields + headline counts (projects fetched separately). */
export interface AdminOrganizationDetail {
  id: string
  name: string
  slug: string
  logo_url: string | null
  created_at: string
  counts: { projects: number; members: number; sessions: number }
}

/** A project row in the admin organization view, carrying its AI-access status. */
export interface AdminProject {
  id: string
  name: string
  environment: string
  status: string
  ai_access: { status: AiAccessStatus; requested_at: string | null; reviewed_at: string | null }
}

interface AdminAiAccessParams {
  status?: AiAccessStatus
  page?: number
  limit?: number
}

const ON_DECISION = ['ai_access:request', 'ai_access:admin:grant', 'ai_access:admin:revoke']

/**
 * AI document-processing access. Project owners read status + request; platform
 * admins list, grant, and revoke. Server-gated by `projects.*` (owner) and
 * `admin.ai_processing.*` (admin).
 */
export class AiAccess {
  /** The project's current AI-processing access (synthetic `none` if never requested). */
  static status(organizationId: string, projectId: string) {
    return alova.Get(`${p(organizationId, projectId)}/ai-access`, {
      name: 'ai_access:status',
      cacheFor: CACHE,
      hitSource: ON_DECISION,
      transform: unwrap<AiAccessGrant>,
    })
  }

  /** Request AI processing for the project (idempotent; no-op once granted). */
  static request(organizationId: string, projectId: string, note?: string) {
    return alova.Post(
      `${p(organizationId, projectId)}/ai-access/request`,
      { note },
      {
        name: 'ai_access:request',
        transform: unwrap<AiAccessGrant>,
      },
    )
  }

  /** Paginated access records across every organization (admin), newest first. */
  static list(query?: AdminAiAccessParams) {
    return alova.Get<Paginated<AiAccessGrant>>('/v1/admin/ai-access', {
      name: 'admin:ai_access',
      cacheFor: CACHE,
      hitSource: ['ai_access:admin:grant', 'ai_access:admin:revoke'],
      params: params(query as Record<string, unknown>),
    })
  }

  /** Count of pending requests (drives the nav badge). */
  static pendingCount() {
    return alova.Get('/v1/admin/ai-access/count', {
      name: 'admin:ai_access:count',
      cacheFor: CACHE,
      hitSource: ['ai_access:admin:grant', 'ai_access:admin:revoke', 'ai_access:request'],
      params: params({ status: 'pending' }),
      transform: (envelope: { data?: { count: number } }) => envelope.data?.count ?? 0,
    })
  }

  /** Grant AI processing to a project (approve a request, or grant directly). */
  static grant(projectId: string) {
    return alova.Post(
      '/v1/admin/ai-access/grant',
      { project_id: projectId },
      {
        name: 'ai_access:admin:grant',
        transform: unwrap<AiAccessGrant>,
      },
    )
  }

  /** Revoke AI processing from a project. */
  static revoke(projectId: string) {
    return alova.Post(
      '/v1/admin/ai-access/revoke',
      { project_id: projectId },
      {
        name: 'ai_access:admin:revoke',
        transform: unwrap<AiAccessGrant>,
      },
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

  /** Paginated projects for an organization (admin), each with its AI-access status. */
  static organizationProjects(organizationId: string, query?: { page?: number; limit?: number }) {
    return alova.Get<Paginated<AdminProject>>(`/v1/admin/organizations/${organizationId}/projects`, {
      name: 'admin:organization:projects',
      cacheFor: CACHE,
      hitSource: ['ai_access:admin:grant', 'ai_access:admin:revoke'],
      params: params(query as Record<string, unknown>),
    })
  }
}
