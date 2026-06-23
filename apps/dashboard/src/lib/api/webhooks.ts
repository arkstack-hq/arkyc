import type { WebhookEndpoint } from '@arkyc/types'
import { CACHE, type Envelope, type Paginated, alova, p, params, unwrap } from './client'
import type { CreateWebhookInput } from './types'

/** Project webhook endpoints (signed event delivery). */
export class Webhooks {
  /**
   * Paginated webhook-endpoint list. Pass `page`/`limit` (usePagination supplies
   * these); consumed via infinite scroll.
   */
  static list(organizationId: string, projectId: string, query?: { page?: number; limit?: number }) {
    return alova.Get<Paginated<WebhookEndpoint>>(`${p(organizationId, projectId)}/webhooks`, {
      name: 'webhooks:list',
      cacheFor: CACHE,
      hitSource: ['webhook:create', 'webhook:update', 'webhook:remove'],
      params: params(query),
    })
  }

  /** Add an endpoint; the signing secret is returned once, here only. */
  static create(organizationId: string, projectId: string, input: CreateWebhookInput) {
    return alova.Post(`${p(organizationId, projectId)}/webhooks`, input, {
      name: 'webhook:create',
      transform: (raw: Envelope<WebhookEndpoint> & { secret: string }) => ({
        ...(raw.data as WebhookEndpoint),
        secret: raw.secret as string,
      }),
    })
  }

  /** Update an endpoint's URL, events, or status. */
  static update(
    organizationId: string,
    projectId: string,
    webhookId: string,
    input: Partial<CreateWebhookInput> & { status?: string },
  ) {
    return alova.Patch(`${p(organizationId, projectId)}/webhooks/${webhookId}`, input, {
      name: 'webhook:update',
      transform: unwrap<WebhookEndpoint>,
    })
  }

  /** Delete an endpoint. */
  static remove(organizationId: string, projectId: string, webhookId: string) {
    return alova.Delete<unknown>(`${p(organizationId, projectId)}/webhooks/${webhookId}`, undefined, {
      name: 'webhook:remove',
    })
  }

  /** Send a test delivery to an endpoint. */
  static test(organizationId: string, projectId: string, webhookId: string) {
    return alova.Post<unknown>(`${p(organizationId, projectId)}/webhooks/${webhookId}/test`, undefined, {
      name: 'webhook:test',
    })
  }
}
