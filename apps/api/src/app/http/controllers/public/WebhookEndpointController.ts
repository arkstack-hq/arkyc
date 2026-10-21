import { HttpContext } from 'clear-router/types/express'
import { perPage } from '@arkstack/common'
import type { WebhookEventName } from '@arkyc/types'
import { BaseController } from '@controllers/BaseController'
import { WebhookEndpoint } from '@app/models/WebhookEndpoint'
import WebhookEndpointResource from '@app/http/resources/WebhookEndpointResource'
import WebhookEndpointCollection from '@app/http/resources/WebhookEndpointCollection'
import { audit } from '@app/services/AuditLogger'
import { webhookService } from '@app/services/WebhookService'
import { createEndpointRules, updateEndpointBySecretRules, updateEndpointRules } from 'src/support/webhook-endpoints'
import { RequestException } from '@arkstack/common'

/**
 * Public Project API (secret API key): manage the authenticated project's webhook
 * endpoints from an integrating backend, e.g. to repoint a dev endpoint at a fresh
 * tunnel URL on boot. Deliberately no delete: a leaked server key can't remove
 * endpoints. `req.projectContext` is resolved by `apiKeyAuth`.
 */
export default class WebhookEndpointController extends BaseController {
  /** List the project's endpoints (the signing secret is never included). */
  async index({ req }: HttpContext) {
    const endpoints = await WebhookEndpoint.where({ projectId: req.projectContext!.project_id }).paginate(
      perPage(req.query),
    )

    return new WebhookEndpointCollection(endpoints).additional({
      status: 'success',
      message: 'OK',
      code: 200,
    })
  }

  /** Fetch one of the project's endpoints. */
  async show({ req }: HttpContext) {
    return new WebhookEndpointResource(await this.scopedEndpoint(req)).additional({
      status: 'success',
      message: 'OK',
      code: 200,
    })
  }

  /** Register an endpoint. The signing secret is returned exactly once (`secret`). */
  async create({ req }: HttpContext) {
    const data = await this.validate(createEndpointRules)
    const context = req.projectContext!

    const { endpoint, secret } = await webhookService.createEndpoint(
      { organizationId: context.organization_id, projectId: context.project_id },
      { url: data.url, events: data.events as WebhookEventName[] },
    )
    await this.audit(req, 'webhook.created', endpoint)

    return new WebhookEndpointResource(endpoint)
      .additional({
        status: 'success',
        message: 'Webhook endpoint created — store the signing secret now; it will not be shown again',
        code: 201,
        secret,
      })
      .response()
      .setStatusCode(201)
  }

  /** Update an endpoint's url / events / status. The signing secret is unchanged. */
  async update({ req }: HttpContext) {
    const data = await this.validate(updateEndpointRules)
    const endpoint = await this.scopedEndpoint(req)

    await webhookService.updateEndpoint(endpoint, {
      url: data.url,
      events: data.events as WebhookEventName[] | null,
      status: data.status,
    })
    await this.audit(req, 'webhook.updated', endpoint)

    return new WebhookEndpointResource(endpoint).additional({
      status: 'success',
      message: 'Webhook endpoint updated',
      code: 200,
    })
  }

  /**
   * Update the endpoint whose signing secret is `secret`, so an integrator that
   * already stores the secret (to verify deliveries) needs no endpoint id, e.g.
   * to repoint a dev endpoint at a fresh tunnel URL on boot. The secret travels
   * in the body (never the URL, which is logged) and is not changed.
   */
  async updateBySecret({ req }: HttpContext) {
    const data = await this.validate(updateEndpointBySecretRules)
    const endpoint = await webhookService.findEndpointBySecret(req.projectContext!.project_id, data.secret)
    if (!endpoint) throw new RequestException('No webhook endpoint in this project has that signing secret', 404)

    await webhookService.updateEndpoint(endpoint, {
      url: data.url,
      events: data.events as WebhookEventName[] | null,
      status: data.status,
    })
    await this.audit(req, 'webhook.updated', endpoint)

    return new WebhookEndpointResource(endpoint).additional({
      status: 'success',
      message: 'Webhook endpoint updated',
      code: 200,
    })
  }

  /** The route's endpoint, scoped to the key's project (404 otherwise). */
  private scopedEndpoint(req: HttpContext['req']) {
    return WebhookEndpoint.where({
      id: String(req.params.id),
      projectId: req.projectContext!.project_id,
    }).firstOrFail()
  }

  /** Record the change against the API key that made it. */
  private audit(req: HttpContext['req'], action: string, endpoint: WebhookEndpoint) {
    return audit.record({
      organizationId: req.projectContext!.organization_id,
      projectId: req.projectContext!.project_id,
      actorId: req.projectContext!.api_key_id,
      actorType: 'api_key',
      action,
      entityType: 'webhook_endpoint',
      entityId: endpoint.id,
      ipAddress: req.ip ?? null,
      userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
    })
  }
}
