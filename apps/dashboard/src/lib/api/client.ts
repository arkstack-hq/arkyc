import { AUTH_TOKEN_KEY, alova } from '@/lib/requests/alova'

import { RequestException } from '@/lib/Exceptions/RequestException'
import { SecureStorage } from '@/lib/Storage/SecureStorage'
import { ValidationException } from '@/lib/Exceptions/ValidationException'
import { env } from '@/config/environment'

/**
 * Shared building blocks for the concern-scoped API classes.
 *
 * Every read is a named, cached alova `Method`; every mutation is a named
 * `Method` that read methods reference through `hitSource` for auto-invalidation
 * (see {@link https://alova.js.org/tutorial/cache/auto-invalidate/}).
 */
export { alova }

/**
 * Default GET cache window (memory L1), in milliseconds.
 */
export const CACHE = 5 * 60 * 1000

/**
 * The standard API envelope every endpoint wraps its payload in.
 */
export interface Envelope<T> {
  status?: string
  message?: string
  code?: number
  data?: T
  errors?: Record<string, string[]>
  [key: string]: unknown
}

/**
 * A server-paginated list envelope (resora paginator).
 */
export interface Paginated<T> {
  data: T[]
  meta: { total: number; per_page: number; current_page: number; last_page: number }
  links?: unknown
  [key: string]: unknown
}

/**
 * Unwrap `{ data }` from a non-paginated envelope.
 *
 * @param error
 * @returns
 */
export const unwrap = <T>(envelope: Envelope<T>): T => envelope.data as T

/** Dashboard organization base path. */
export const t = (organizationId: string) => `/v1/dashboard/organizations/${organizationId}`
/** Dashboard project base path. */
export const p = (organizationId: string, projectId: string) => `${t(organizationId)}/projects/${projectId}`

/**
 * Build a query-param object, dropping empty values.
 *
 * @param error
 * @returns
 */
export function params(input?: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  if (!input) return out
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== null && value !== '') out[key] = String(value)
  }
  return out
}

/**
 * Whether a persisted JWT exists (used to gate the initial `/auth/me`).
 *
 * @param error
 * @returns
 */
export const hasAuthToken = (): boolean => Boolean(localStorage.getItem(AUTH_TOKEN_KEY))

/**
 * Drop the persisted JWT (sign-out / failed restore).
 *
 * @param error
 * @returns
 */
export const clearAuthToken = (): Promise<void> => SecureStorage.remove(AUTH_TOKEN_KEY)

export { RequestException, ValidationException }
export type { ApiException } from '@/lib/Exceptions/ValidationException'

/**
 * HTTP status of a thrown API error, if any.
 *
 * @param error
 * @returns
 */
export const errorStatus = (error: unknown): number | undefined =>
  error instanceof RequestException ? error.statusCode : undefined

/**
 * Whether a thrown API error is a 403 (permission denied).
 *
 * @param error
 * @returns
 */
export const isForbidden = (error: unknown): boolean => errorStatus(error) === 403

/**
 * A human-readable message for any thrown error, with a safe fallback.
 *
 * @param error
 * @param fallback
 * @returns
 */
export const errorMessage = (error: unknown, fallback = 'Something went wrong. Please try again.'): string =>
  error instanceof RequestException ? error.message : fallback

/** API origin + `/api` prefix, matching the alova instance's baseURL. */
const API_BASE = env('VITE_API_URL', '') + '/api'

/**
 * Fetch a private session media artifact (document/selfie image, liveness video)
 * through the authenticated `sessions.view`-gated route and return an object URL.
 * Uses a raw fetch (not alova) because the global response handler parses JSON —
 * it can't carry binary. Revoke the returned URL when done.
 */
export async function fetchSessionMedia(organizationId: string, sessionId: string, kind: string): Promise<string> {
  const token = await SecureStorage.get<string>(AUTH_TOKEN_KEY)
  const res = await fetch(`${API_BASE}${t(organizationId)}/sessions/${sessionId}/media/${kind}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error(`Failed to load media (${res.status})`)
  return URL.createObjectURL(await res.blob())
}
