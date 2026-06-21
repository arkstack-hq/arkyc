import { randomBytes } from 'node:crypto'
import { HttpContext } from 'clear-router/types/express'
import { BaseController } from '@controllers/BaseController'
import type { WebhookEventName } from '@arkyc/types'
import { Project } from '@app/models/Project'
import { WebhookEndpoint } from '@app/models/WebhookEndpoint'
import WebhookEndpointResource from '@app/http/resources/WebhookEndpointResource'
import WebhookEndpointCollection from '@app/http/resources/WebhookEndpointCollection'
import { audit } from '@app/services/AuditLogger'
import { webhookService } from '@app/services/WebhookService'

/** The webhook event names a subscription may include. */
const EVENT_NAMES: WebhookEventName[] = [
  'verification.started',
  'verification.document_submitted',
  'verification.processing',
  'verification.requires_review',
  'verification.approved',
  'verification.rejected',
  'verification.completed',
  'verification.expired',
  'verification.cancelled',
]
const EVENTS_RULE = `in:${EVENT_NAMES.join(',')}`

/** Webhook endpoint management for a project. Gated by `webhooks.*`. */
export default class WebhookEndpointController extends BaseController {
  /** List a project's webhook endpoints (secret never included). */
  async index({ req }: HttpContext) {
    const project = await this.scopedProject(req)
    const endpoints = await WebhookEndpoint.where({ projectId: project.id }).get()

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
    const data = await this.validate({
      url: ['required', 'string', 'max:2048'],
      events: ['required', 'array'],
      'events.*': ['string', EVENTS_RULE],
    })

    const secret = `whsec_${randomBytes(24).toString('hex')}`
    const endpoint = await WebhookEndpoint.create({
      tenantId: project.tenantId,
      projectId: project.id,
      url: data.url,
      secretHash: secret,
      events: data.events as WebhookEventName[],
      status: 'active',
    })

    await audit.recordForRequest(req, {
      projectId: project.id,
      action: 'webhook.created',
      entityType: 'webhook_endpoint',
      entityId: endpoint.id,
    })

    return new WebhookEndpointResource(endpoint)
      .additional({
        status: 'success',
        message:
          'Webhook endpoint created — store the signing secret now; it will not be shown again',
        code: 201,
        secret,
      })
      .response()
      .setStatusCode(201)
  }

  /** Update an endpoint's url / events / status. */
  async update({ req }: HttpContext) {
    const project = await this.scopedProject(req)
    const data = await this.validate({
      url: ['nullable', 'string', 'max:2048'],
      events: ['nullable', 'array'],
      'events.*': ['string', EVENTS_RULE],
      status: ['nullable', 'in:active,disabled'],
    })

    const endpoint = await WebhookEndpoint.where({
      id: req.params.webhookId,
      projectId: project.id,
    }).firstOrFail()
    if (data.url) endpoint.url = data.url
    if (data.events) endpoint.events = data.events as WebhookEventName[]
    if (data.status) endpoint.status = data.status
    await endpoint.save()

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

  /** Resolve the route's project, scoped to the active tenant (404 otherwise). */
  private scopedProject(req: HttpContext['req']) {
    return Project.where({ id: req.params.projectId, tenantId: req.tenant!.id }).firstOrFail()
  }
}
