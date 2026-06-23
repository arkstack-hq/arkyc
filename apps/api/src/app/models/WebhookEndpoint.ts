import { Model } from 'arkormx'
import type { CastMap } from 'arkormx'
import type { WebhookEndpointStatus, WebhookEventName } from '@arkyc/types'
import { Organization } from './Organization'
import { Project } from './Project'
import { WebhookDelivery } from './WebhookDelivery'

export class WebhookEndpoint extends Model {
  protected static override table = 'webhook_endpoints'

  declare id: string
  declare organizationId: string
  declare projectId: string
  declare url: string
  declare secretHash: string
  declare events: WebhookEventName[]
  declare status: WebhookEndpointStatus
  declare createdAt: Date
  declare updatedAt: Date

  protected static override columns = {
    organizationId: 'organization_id',
    projectId: 'project_id',
    secretHash: 'secret_hash',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }

  protected override casts: CastMap = {
    events: 'json',
  }

  /** The signing secret hash is never serialised. */
  protected override hidden = ['secretHash']

  organization() {
    return this.belongsTo(Organization, 'organizationId')
  }

  project() {
    return this.belongsTo(Project, 'projectId')
  }

  deliveries() {
    return this.hasMany(WebhookDelivery, 'webhookEndpointId')
  }
}
