import { Model } from 'arkormx'
import type { CastMap } from 'arkormx'
import type { WebhookDeliveryStatus, WebhookEvent, WebhookEventName } from '@arkyc/types'
import { Organization } from './Organization'
import { Project } from './Project'
import { WebhookEndpoint } from './WebhookEndpoint'

export class WebhookDelivery extends Model {
  protected static override table = 'webhook_deliveries'

  declare id: string
  declare organizationId: string
  declare projectId: string
  declare webhookEndpointId: string
  declare event: WebhookEventName
  declare payload: WebhookEvent
  declare status: WebhookDeliveryStatus
  declare responseStatus: number | null
  declare responseBody: string | null
  declare attempts: number
  declare nextRetryAt: Date | null
  declare createdAt: Date
  declare updatedAt: Date

  protected static override columns = {
    organizationId: 'organization_id',
    projectId: 'project_id',
    webhookEndpointId: 'webhook_endpoint_id',
    responseStatus: 'response_status',
    responseBody: 'response_body',
    nextRetryAt: 'next_retry_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }

  protected override casts: CastMap = {
    payload: 'json',
  }

  organization() {
    return this.belongsTo(Organization, 'organizationId')
  }

  project() {
    return this.belongsTo(Project, 'projectId')
  }

  endpoint() {
    return this.belongsTo(WebhookEndpoint, 'webhookEndpointId')
  }
}
