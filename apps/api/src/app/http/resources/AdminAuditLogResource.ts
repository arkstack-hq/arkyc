import { Resource } from 'resora'

/**
 * A platform audit-trail entry. Like the tenant {@link AuditLogResource} but
 * includes `tenant_id`, since the admin surface spans every tenant.
 */
export default class AdminAuditLogResource extends Resource {
  data() {
    return {
      id: this.id,
      tenant_id: this.tenantId,
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
