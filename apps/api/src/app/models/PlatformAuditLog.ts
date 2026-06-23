import { Model } from 'arkormx'
import type { CastMap } from 'arkormx'
import type { ActorType, Metadata } from '@arkyc/types'
import { User } from './User'

/**
 * An append-only platform-admin audit entry. Mirrors {@link AuditLog} but has no
 * organization/project scope; `actor` is the admin user who performed the action.
 */
export class PlatformAuditLog extends Model {
  protected static override table = 'platform_audit_logs'

  declare id: string
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

  actor() {
    return this.belongsTo(User, 'actorId')
  }
}
