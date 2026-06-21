import type { ApiKey } from '@arkyc/types'
import { CACHE, type Envelope, type Paginated, alova, p, params } from './client'

/** Project API keys (server-side secret credentials). */
export class ApiKeys {
  /**
   * Paginated API-key list (never includes the secret hash). Pass `page`/`limit`
   * (usePagination supplies these); consumed via infinite scroll.
   */
  static list(tenantId: string, projectId: string, query?: { page?: number; limit?: number }) {
    return alova.Get<Paginated<ApiKey>>(`${p(tenantId, projectId)}/api-keys`, {
      name: 'apiKeys:list',
      cacheFor: CACHE,
      hitSource: ['apiKey:create', 'apiKey:revoke'],
      params: params(query),
    })
  }

  /** Mint an API key; the plaintext secret is returned once, here only. */
  static create(tenantId: string, projectId: string, input: { name: string }) {
    return alova.Post(`${p(tenantId, projectId)}/api-keys`, input, {
      name: 'apiKey:create',
      transform: (raw: Envelope<ApiKey> & { secret: string }) => ({
        ...(raw.data as ApiKey),
        secret: raw.secret,
      }),
    })
  }

  /** Revoke an API key. */
  static revoke(tenantId: string, projectId: string, keyId: string) {
    return alova.Delete<unknown>(`${p(tenantId, projectId)}/api-keys/${keyId}`, undefined, {
      name: 'apiKey:revoke',
    })
  }
}
