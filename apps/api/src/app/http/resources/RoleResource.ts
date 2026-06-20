import { Resource } from 'resora'

export default class RoleResource extends Resource {
    data () {
        return {
            id: this.id,
            tenant_id: this.tenantId,
            name: this.name,
            slug: this.slug,
            description: this.description ?? null,
            is_system: this.isSystem,
            created_at: this.createdAt,
        }
    }
}
