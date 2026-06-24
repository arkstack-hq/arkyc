import type { VerificationSession } from '@arkyc/types'
import { CACHE, type Paginated, alova, params, t, unwrap } from './client'
import type { SessionListQuery } from './types'

/** All session-mutating method names; read methods invalidate on any of them. */
const SESSION_MUTATIONS = [
  'session:approve',
  'session:reject',
  'session:retry',
  'session:assign',
  'session:suspicious',
  'session:note',
]

type SessionListParams = SessionListQuery & { page?: number; limit?: number }

/** Verification sessions: paginated list, detail, and reviewer actions. */
export class Sessions {
  /**
   * Paginated session list. Pass `page`/`limit` (usePagination supplies these)
   * alongside any filters.
   */
  static list(organizationId: string, query?: SessionListParams) {
    return alova.Get<Paginated<VerificationSession>>(`${t(organizationId)}/sessions`, {
      name: 'sessions:list',
      cacheFor: CACHE,
      hitSource: SESSION_MUTATIONS,
      params: params(query as Record<string, unknown>),
    })
  }

  /** A single session with its full check breakdown. */
  static get(organizationId: string, id: string) {
    return alova.Get(`${t(organizationId)}/sessions/${id}`, {
      name: 'session:detail',
      cacheFor: CACHE,
      hitSource: SESSION_MUTATIONS,
      transform: unwrap<VerificationSession & Record<string, unknown>>,
    })
  }

  /** Approve a session awaiting review. */
  static approve(organizationId: string, id: string, input?: { reason?: string }) {
    return alova.Post<unknown>(`${t(organizationId)}/sessions/${id}/approve`, input ?? {}, {
      name: 'session:approve',
    })
  }

  /** Reject a session awaiting review. */
  static reject(organizationId: string, id: string, input?: { reason?: string }) {
    return alova.Post<unknown>(`${t(organizationId)}/sessions/${id}/reject`, input ?? {}, {
      name: 'session:reject',
    })
  }

  /** Ask the user to retry part of the flow. `kind` is required by the API. */
  static requestRetry(
    organizationId: string,
    id: string,
    input: { kind: 'document' | 'selfie' | 'full'; reason?: string },
  ) {
    return alova.Post<unknown>(`${t(organizationId)}/sessions/${id}/request-retry`, input, {
      name: 'session:retry',
    })
  }

  /** Assign (or unassign) the session to a reviewer. */
  static assign(organizationId: string, id: string, input: { assigned_to: string | null }) {
    return alova.Post<unknown>(`${t(organizationId)}/sessions/${id}/assign`, input, {
      name: 'session:assign',
    })
  }

  /** Flag a session as suspicious. */
  static markSuspicious(organizationId: string, id: string, input?: { reason?: string }) {
    return alova.Post<unknown>(`${t(organizationId)}/sessions/${id}/suspicious`, input ?? {}, {
      name: 'session:suspicious',
    })
  }

  /** Attach an internal note to a session. */
  static note(organizationId: string, id: string, input: { body: string }) {
    return alova.Post<unknown>(`${t(organizationId)}/sessions/${id}/notes`, input, {
      name: 'session:note',
    })
  }
}
