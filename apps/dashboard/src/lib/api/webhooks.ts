import type { WebhookDelivery, WebhookDeliveryDetail, WebhookDeliveryStatus, WebhookEndpoint } from '@arkyc/types'
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
      hitSource: ['webhook:create', 'webhook:update', 'webhook:remove', 'webhook:rotate-secret'],
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

  /** Replace an endpoint's signing secret; the new secret is returned once, here only. */
  static rotateSecret(organizationId: string, projectId: string, webhookId: string) {
    return alova.Patch(`${p(organizationId, projectId)}/webhooks/${webhookId}/secret`, undefined, {
      name: 'webhook:rotate-secret',
      transform: (raw: Envelope<WebhookEndpoint> & { secret: string }) => ({
        ...(raw.data as WebhookEndpoint),
        secret: raw.secret as string,
      }),
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

  /** Paginated deliveries for an endpoint, newest first, optionally filtered by status. */
  static deliveries(
    organizationId: string,
    projectId: string,
    webhookId: string,
    query?: { page?: number; limit?: number; status?: WebhookDeliveryStatus },
  ) {
    return alova.Get<Paginated<WebhookDelivery>>(`${p(organizationId, projectId)}/webhooks/${webhookId}/deliveries`, {
      name: 'webhooks:deliveries',
      params: params(query),
    })
  }

  /** One delivery with the payload sent and the endpoint's response. */
  static delivery(organizationId: string, projectId: string, webhookId: string, deliveryId: string) {
    return alova.Get(`${p(organizationId, projectId)}/webhooks/${webhookId}/deliveries/${deliveryId}`, {
      name: 'webhooks:delivery',
      transform: unwrap<WebhookDeliveryDetail>,
    })
  }

  /** Resend one failed delivery. */
  static resend(organizationId: string, projectId: string, webhookId: string, deliveryId: string) {
    return alova.Patch(
      `${p(organizationId, projectId)}/webhooks/${webhookId}/deliveries/${deliveryId}/resend`,
      undefined,
      { name: 'webhook:resend', transform: unwrap<WebhookDelivery> },
    )
  }

  /** Resend every failed delivery of an endpoint in the background; resolves to how many were queued. */
  static resendFailed(organizationId: string, projectId: string, webhookId: string) {
    return alova.Patch(`${p(organizationId, projectId)}/webhooks/${webhookId}/deliveries/resend`, undefined, {
      name: 'webhook:resend-failed',
      transform: (raw: Envelope<WebhookEndpoint> & { queued?: number }) => Number(raw.queued ?? 0),
    })
  }
}
