import { Model } from 'arkormx'
import { Organization } from './Organization'
import { Role } from './Role'

export class OrganizationInvitation extends Model {
  protected static override table = 'organization_invitations'

  declare id: string
  declare organizationId: string
  declare email: string
  declare roleId: string
  declare tokenHash: string
  declare expiresAt: Date
  declare acceptedAt: Date | null
  declare createdAt: Date
  declare updatedAt: Date

  protected static override columns = {
    organizationId: 'organization_id',
    roleId: 'role_id',
    tokenHash: 'token_hash',
    expiresAt: 'expires_at',
    acceptedAt: 'accepted_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }

  organization() {
    return this.belongsTo(Organization, 'organizationId')
  }

  role() {
    return this.belongsTo(Role, 'roleId')
  }
}
