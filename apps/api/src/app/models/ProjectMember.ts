import { Model } from 'arkormx'
import type { MembershipStatus } from '@arkyc/types'
import { Organization } from './Organization'
import { Project } from './Project'
import { Role } from './Role'
import { User } from './User'

export class ProjectMember extends Model {
  protected static override table = 'project_members'

  declare id: string
  declare organizationId: string
  declare projectId: string
  declare userId: string
  declare roleId: string
  declare status: MembershipStatus
  declare createdAt: Date
  declare updatedAt: Date

  protected static override columns = {
    organizationId: 'organization_id',
    projectId: 'project_id',
    userId: 'user_id',
    roleId: 'role_id',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }

  organization() {
    return this.belongsTo(Organization, 'organizationId')
  }

  project() {
    return this.belongsTo(Project, 'projectId')
  }

  user() {
    return this.belongsTo(User, 'userId')
  }

  role() {
    return this.belongsTo(Role, 'roleId')
  }
}
