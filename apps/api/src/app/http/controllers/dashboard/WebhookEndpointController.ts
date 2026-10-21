import { HttpContext } from 'clear-router/types/express'
import { perPage } from '@arkstack/common'
import { BaseController } from '@controllers/BaseController'
import type { WebhookEventName } from '@arkyc/types'
import { Project } from '@app/models/Project'
import { WebhookEndpoint } from '@app/models/WebhookEndpoint'
import WebhookEndpointResource from '@app/http/resources/WebhookEndpointResource'
import WebhookEndpointCollection from '@app/http/resources/WebhookEndpointCollection'
import { audit } from '@app/services/AuditLogger'
import { webhookService } from '@app/services/WebhookService'
import { createEndpointRules, updateEndpointRules } from 'src/support/webhook-endpoints'

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

  /** Resolve the route's project, scoped to the active organization (404 otherwise). */
  private scopedProject(req: HttpContext['req']) {
    return Project.where({ id: req.params.projectId, organizationId: req.organization!.id }).firstOrFail()
  }
}
