import { Model } from 'arkormx'
import type { CastMap } from 'arkormx'
import type { ActorType, Metadata } from '@arkyc/types'
import { Organization } from './Organization'
import { Project } from './Project'

export class AuditLog extends Model {
  protected static override table = 'audit_logs'

  declare id: string
  declare organizationId: string
  declare projectId: string | null
  declare actorId: string | null
  declare actorType: ActorType
  declare action: string
  declare entityType: string
  declare entityId: string | null
  declare metadata: Metadata | null
  declare ipAddress: string | null
  declare userAgent: string | null
  declare createdAt: Date
  declare updatedAt: Date

  protected static override columns = {
    organizationId: 'organization_id',
    projectId: 'project_id',
    actorId: 'actor_id',
    actorType: 'actor_type',
    entityType: 'entity_type',
    entityId: 'entity_id',
    ipAddress: 'ip_address',
    userAgent: 'user_agent',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }

  protected override casts: CastMap = {
    metadata: 'json',
  }

  organization() {
    return this.belongsTo(Organization, 'organizationId')
  }

  project() {
    return this.belongsTo(Project, 'projectId')
  }
}
