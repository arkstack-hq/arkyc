import { HttpContext } from 'clear-router/types/express'
import { perPage } from '@arkstack/common'
import { BaseController } from '@controllers/BaseController'
import type { WebhookEventName } from '@arkyc/types'
import { Project } from '@app/models/Project'
import { WebhookDelivery } from '@app/models/WebhookDelivery'
import { WebhookEndpoint } from '@app/models/WebhookEndpoint'
import WebhookDeliveryResource from '@app/http/resources/WebhookDeliveryResource'
import WebhookDeliveryDetailResource from '@app/http/resources/WebhookDeliveryDetailResource'
import WebhookDeliveryCollection from '@app/http/resources/WebhookDeliveryCollection'
import WebhookEndpointResource from '@app/http/resources/WebhookEndpointResource'
import WebhookEndpointCollection from '@app/http/resources/WebhookEndpointCollection'
import { audit } from '@app/services/AuditLogger'
import { webhookService } from '@app/services/WebhookService'
import { createEndpointRules, deliveryStatusFilter, updateEndpointRules } from 'src/support/webhook-endpoints'

/** Webhook endpoint management for a project. Gated by `webhooks.*`. */
export default class WebhookEndpointController extends BaseController {
  /** List a project's webhook endpoints (secret never included). */
  async index({ req }: HttpContext) {
    const project = await this.scopedProject(req)
    const endpoints = await WebhookEndpoint.where({ projectId: project.id }).paginate(perPage(req.query))

    return new WebhookEndpointCollection(endpoints).additional({
      status: 'success',
      message: 'OK',
      code: 200,
    })
  }

  /**
   * Register an endpoint. The signing secret is generated and returned exactly
   * once (stored server-side for signing future deliveries).
   */
  async create({ req }: HttpContext) {
    const project = await this.scopedProject(req)
    const data = await this.validate(createEndpointRules)

    const { endpoint, secret } = await webhookService.createEndpoint(
      { organizationId: project.organizationId, projectId: project.id },
      { url: data.url, events: data.events as WebhookEventName[] },
    )

    await audit.recordForRequest(req, {
      projectId: project.id,
      action: 'webhook.created',
      entityType: 'webhook_endpoint',
      entityId: endpoint.id,
    })

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

  /** Update an endpoint's url / events / status. */
  async update({ req }: HttpContext) {
    const project = await this.scopedProject(req)
    const data = await this.validate(updateEndpointRules)

    const endpoint = await WebhookEndpoint.where({
      id: req.params.webhookId,
      projectId: project.id,
    }).firstOrFail()

    await webhookService.updateEndpoint(endpoint, {
      url: data.url,
      events: data.events as WebhookEventName[] | null,
      status: data.status,
    })

    await audit.recordForRequest(req, {
      projectId: project.id,
      action: 'webhook.updated',
      entityType: 'webhook_endpoint',
      entityId: endpoint.id,
    })

    return new WebhookEndpointResource(endpoint).additional({
      status: 'success',
      message: 'Webhook endpoint updated',
      code: 200,
    })
  }

  /** Delete an endpoint. */
  async destroy({ req }: HttpContext) {
    const project = await this.scopedProject(req)
    const endpoint = await WebhookEndpoint.where({
      id: req.params.webhookId,
      projectId: project.id,
    }).firstOrFail()

    await endpoint.delete()

    await audit.recordForRequest(req, {
      projectId: project.id,
      action: 'webhook.deleted',
      entityType: 'webhook_endpoint',
      entityId: endpoint.id,
    })

    return new WebhookEndpointResource(endpoint).additional({
      status: 'success',
      message: 'Webhook endpoint deleted',
      code: 200,
    })
  }

  /** Queue a sample delivery to the endpoint to verify connectivity. */
  async test({ req }: HttpContext) {
    const project = await this.scopedProject(req)
    const endpoint = await WebhookEndpoint.where({
      id: req.params.webhookId,
      projectId: project.id,
    }).firstOrFail()

    await webhookService.sendTest(endpoint)

    return new WebhookEndpointResource(endpoint).additional({
      status: 'success',
      message: 'Test delivery queued',
      code: 202,
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

    await audit.recordForRequest(req, {
      projectId: endpoint.projectId,
      action: 'webhook.delivery_resent',
      entityType: 'webhook_delivery',
      entityId: delivery.id,
    })

    return new WebhookDeliveryResource(resent)
      .additional({ status: 'success', message: 'Delivery resent', code: 201 })
      .response()
      .setStatusCode(201)
  }

  /** Re-queue every failed delivery of an endpoint in the background. */
  async resendFailed({ req }: HttpContext) {
    const endpoint = await this.scopedEndpoint(req)

    const queued = await webhookService.resendFailed(endpoint)

    await audit.recordForRequest(req, {
      projectId: endpoint.projectId,
      action: 'webhook.failed_deliveries_resent',
      entityType: 'webhook_endpoint',
      entityId: endpoint.id,
    })

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

  /** Resolve the route's endpoint within its scoped project (404 otherwise). */
  private async scopedEndpoint(req: HttpContext['req']) {
    const webhookId = String(req.params.webhookId)
    const project = await this.scopedProject(req)

    return WebhookEndpoint.where({ id: webhookId, projectId: project.id }).firstOrFail()
  }

  /** Resolve the route's project, scoped to the active organization (404 otherwise). */
  private scopedProject(req: HttpContext['req']) {
    return Project.where({ id: req.params.projectId, organizationId: req.organization!.id }).firstOrFail()
  }
}
