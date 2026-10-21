import type {
  CreateWebhookEndpointParams,
  CreatedWebhookEndpoint,
  ListWebhookEndpointsParams,
  UpdateWebhookEndpointParams,
  WebhookEndpoint,
} from './types'

type Request = (method: string, path: string, body?: unknown) => Promise<Record<string, unknown>>

/**
 * Manage the project's webhook endpoints through the Public Project API, e.g. to
 * repoint a development endpoint at a fresh tunnel URL on boot. There is no
 * delete: endpoints are removed from the dashboard.
 */
export class WebhookEndpoints {
  constructor(private readonly request: Request) {}

  /**
   * List the project's endpoints (one page).
   *
   * @param params
   * @returns
   */
  async list(params: ListWebhookEndpointsParams = {}): Promise<WebhookEndpoint[]> {
    const query = new URLSearchParams()
    if (params.page) query.set('page', String(params.page))
    if (params.perPage) query.set('per_page', String(params.perPage))
    const qs = query.toString()
    const suffix = qs ? `?${qs}` : ''

    return (await this.request('GET', `/v1/webhooks${suffix}`)).data as WebhookEndpoint[]
  }

  /**
   * Fetch an endpoint by id.
   *
   * @param id
   * @returns
   */
  async retrieve(id: string): Promise<WebhookEndpoint> {
    return (await this.request('GET', `/v1/webhooks/${encodeURIComponent(id)}`)).data as WebhookEndpoint
  }

  /**
   * Register an endpoint. The returned `secret` signs every delivery and is shown
   * only this once, so store it (e.g. as `ARKYC_WEBHOOK_SECRET`).
   *
   * @param params
   * @returns
   */
  async create(params: CreateWebhookEndpointParams): Promise<CreatedWebhookEndpoint> {
    const body = await this.request('POST', '/v1/webhooks', { url: params.url, events: params.events })

    return { endpoint: body.data as WebhookEndpoint, secret: body.secret as string }
  }

  /**
   * Update an endpoint's url, events or status. Only the fields supplied change,
   * and the signing secret stays the same.
   *
   * @param id
   * @param params
   * @returns
   */
  async update(id: string, params: UpdateWebhookEndpointParams): Promise<WebhookEndpoint> {
    const body = await this.request('PATCH', `/v1/webhooks/${encodeURIComponent(id)}`, {
      url: params.url,
      events: params.events,
      status: params.status,
    })

    return body.data as WebhookEndpoint
  }

  /**
   * Update the endpoint whose signing secret is `secret`, without needing its id:
   * a backend that already stores the secret to verify deliveries can, say,
   * repoint its endpoint at a fresh tunnel URL on boot. The secret is sent in the
   * request body and stays the same. Rejects with a 404 `ArkycApiError` when no
   * endpoint in the project has that secret.
   *
   * @param secret  The endpoint's `whsec_…` signing secret.
   * @param params
   * @returns
   */
  async updateBySecret(secret: string, params: UpdateWebhookEndpointParams): Promise<WebhookEndpoint> {
    const body = await this.request('PATCH', '/v1/webhooks', {
      secret,
      url: params.url,
      events: params.events,
      status: params.status,
    })

    return body.data as WebhookEndpoint
  }
}
