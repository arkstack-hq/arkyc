import { Model } from 'arkormx'
import { Organization } from './Organization'
import { Project } from './Project'
import { User } from './User'
import { Permission } from './Permission'

export class UserPermission extends Model {
  protected static override table = 'user_permissions'

  declare id: string
  declare organizationId: string
  declare projectId: string | null
  declare userId: string
  declare permissionId: string
  declare createdAt: Date
  declare updatedAt: Date

  protected static override columns = {
    organizationId: 'organization_id',
    projectId: 'project_id',
    userId: 'user_id',
    permissionId: 'permission_id',
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

  permission() {
    return this.belongsTo(Permission, 'permissionId')
  }
}
