import { Resource } from 'resora'

/** A single audit-trail entry. */
export default class AuditLogResource extends Resource {
  data () {
    return {
      id: this.id,
      project_id: this.projectId ?? null,
      actor_id: this.actorId ?? null,
      actor_type: this.actorType,
      action: this.action,
      entity_type: this.entityType,
      entity_id: this.entityId ?? null,
      metadata: this.metadata ?? null,
      ip_address: this.ipAddress ?? null,
      user_agent: this.userAgent ?? null,
      created_at: this.createdAt,
    }
  }
}
