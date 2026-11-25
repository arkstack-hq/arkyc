import { HttpContext } from 'clear-router/types/express'
import { perPage } from '@arkstack/common'
import type { WebhookEventName } from '@arkyc/types'
import { BaseController } from '@controllers/BaseController'
import { WebhookDelivery } from '@app/models/WebhookDelivery'
import { WebhookEndpoint } from '@app/models/WebhookEndpoint'
import WebhookDeliveryResource from '@app/http/resources/WebhookDeliveryResource'
import WebhookDeliveryDetailResource from '@app/http/resources/WebhookDeliveryDetailResource'
import WebhookDeliveryCollection from '@app/http/resources/WebhookDeliveryCollection'
import WebhookEndpointResource from '@app/http/resources/WebhookEndpointResource'
import WebhookEndpointCollection from '@app/http/resources/WebhookEndpointCollection'
import { audit } from '@app/services/AuditLogger'
import { webhookService } from '@app/services/WebhookService'
import {
  createEndpointRules,
  deliveryStatusFilter,
  updateEndpointBySecretRules,
  updateEndpointRules,
} from 'src/support/webhook-endpoints'
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

  /** List an endpoint's deliveries, newest first. Filter with the `status` query param. */
  async deliveries({ req }: HttpContext) {
    const status = deliveryStatusFilter(req.query.status)
    const endpoint = await this.scopedEndpoint(req)
    const deliveries = await webhookService.deliveries(endpoint, status).paginate(perPage(req.query))

    return new WebhookDeliveryCollection(deliveries).additional({
      status: 'success',
      message: 'OK',
      code: 200,
    })
  }

  /** Fetch one delivery with the payload sent and the endpoint's response. */
  async delivery({ req }: HttpContext) {
    const deliveryId = String(req.params.deliveryId)
    const endpoint = await this.scopedEndpoint(req)
    const delivery = await WebhookDelivery.where({ id: deliveryId, webhookEndpointId: endpoint.id }).firstOrFail()

    return new WebhookDeliveryDetailResource(delivery).additional({
      status: 'success',
      message: 'OK',
      code: 200,
    })
  }

  /** Re-queue one failed delivery. */
  async resend({ req }: HttpContext) {
    const deliveryId = String(req.params.deliveryId)
    const endpoint = await this.scopedEndpoint(req)
    const delivery = await WebhookDelivery.where({ id: deliveryId, webhookEndpointId: endpoint.id }).firstOrFail()

    const resent = await webhookService.resend(endpoint, delivery)

    await this.audit(req, 'webhook.delivery_resent', { type: 'webhook_delivery', id: delivery.id })

    return new WebhookDeliveryResource(resent)
      .additional({ status: 'success', message: 'Delivery resent', code: 201 })
      .response()
      .setStatusCode(201)
  }

  /** Re-queue every failed delivery of an endpoint in the background. */
  async resendFailed({ req }: HttpContext) {
    const endpoint = await this.scopedEndpoint(req)

    const queued = await webhookService.resendFailed(endpoint)

    await this.audit(req, 'webhook.failed_deliveries_resent', endpoint)

    return new WebhookEndpointResource(endpoint)
      .additional({
        status: 'success',
        message: queued ? `Resending ${queued} failed deliveries` : 'No failed deliveries to resend',
        code: 201,
        queued,
      })
      .response()
      .setStatusCode(201)
  }

  /** Replace an endpoint's signing secret; the new secret is returned exactly once (`secret`). */
  async rotateSecret({ req }: HttpContext) {
    const endpoint = await this.scopedEndpoint(req)

    const secret = await webhookService.rotateSecret(endpoint)

    await this.audit(req, 'webhook.secret_rotated', endpoint)

    return new WebhookEndpointResource(endpoint)
      .additional({
        status: 'success',
        message: 'Signing secret rotated — store the new secret now; it will not be shown again',
        code: 201,
        secret,
      })
      .response()
      .setStatusCode(201)
  }

  /** The route's endpoint, scoped to the key's project (404 otherwise). */
  private scopedEndpoint(req: HttpContext['req']) {
    return WebhookEndpoint.where({
      id: String(req.params.id),
      projectId: req.projectContext!.project_id,
    }).firstOrFail()
  }

  /** Record the change against the API key that made it. */
  private audit(req: HttpContext['req'], action: string, entity: WebhookEndpoint | { type: string; id: string }) {
    const target = entity instanceof WebhookEndpoint ? { type: 'webhook_endpoint', id: entity.id } : entity

    return audit.record({
      organizationId: req.projectContext!.organization_id,
      projectId: req.projectContext!.project_id,
      actorId: req.projectContext!.api_key_id,
      actorType: 'api_key',
      action,
      entityType: target.type,
      entityId: target.id,
      ipAddress: req.ip ?? null,
      userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
    })
  }
}
