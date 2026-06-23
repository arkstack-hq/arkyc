import { Model } from 'arkormx'
import { Organization } from './Organization'
import { Project } from './Project'

export class ApiKey extends Model {
  protected static override table = 'api_keys'

  declare id: string
  declare organizationId: string
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
    organizationId: 'organization_id',
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

  organization() {
    return this.belongsTo(Organization, 'organizationId')
  }

  project() {
    return this.belongsTo(Project, 'projectId')
  }
}
