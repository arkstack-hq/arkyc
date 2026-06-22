import { Resource } from 'resora'

type Related = { getAttribute(key: string): unknown } | null | undefined

/** A platform-admin audit entry, with the acting user (if still present). */
export default class AdminAuditLogResource extends Resource {
  data() {
    const actor = this.resource.getAttribute('actor') as Related

    return {
      id: this.id,
      actor_id: this.actorId ?? null,
      actor_type: this.actorType,
      actor: actor
        ? {
            id: actor.getAttribute('id'),
            name: actor.getAttribute('name'),
            email: actor.getAttribute('email'),
          }
        : null,
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
