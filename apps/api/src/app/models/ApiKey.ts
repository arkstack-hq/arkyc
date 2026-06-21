import { Model } from 'arkormx'
import { Tenant } from './Tenant'
import { Project } from './Project'

export class ApiKey extends Model {
  protected static override table = 'api_keys'

  declare id: string
  declare tenantId: string
  declare projectId: string
  declare name: string
  declare keyPrefix: string
  declare keyHash: string
  declare lastUsedAt: Date | null
  declare expiresAt: Date | null
  declare revokedAt: Date | null
  declare createdAt: Date
  declare updatedAt: Date

  protected static override columns = {
    tenantId: 'tenant_id',
    projectId: 'project_id',
    keyPrefix: 'key_prefix',
    keyHash: 'key_hash',
    lastUsedAt: 'last_used_at',
    expiresAt: 'expires_at',
    revokedAt: 'revoked_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }

  /** The secret hash is never serialised to API responses. */
  protected override hidden = ['keyHash']

  tenant() {
    return this.belongsTo(Tenant, 'tenantId')
  }

  project() {
    return this.belongsTo(Project, 'projectId')
  }
}
