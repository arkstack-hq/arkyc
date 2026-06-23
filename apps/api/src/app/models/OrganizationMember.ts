import { Model } from 'arkormx'
import type { MembershipStatus } from '@arkyc/types'
import { Organization } from './Organization'
import { Role } from './Role'
import { User } from './User'

export class OrganizationMember extends Model {
  protected static override table = 'organization_members'

  declare id: string
  declare organizationId: string
  declare userId: string
  declare roleId: string
  declare status: MembershipStatus
  declare joinedAt: Date | null
  declare createdAt: Date
  declare updatedAt: Date

  protected static override columns = {
    organizationId: 'organization_id',
    userId: 'user_id',
    roleId: 'role_id',
    joinedAt: 'joined_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }

  organization() {
    return this.belongsTo(Organization, 'organizationId')
  }

  user() {
    return this.belongsTo(User, 'userId')
  }

  role() {
    return this.belongsTo(Role, 'roleId')
  }
}
