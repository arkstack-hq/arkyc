import { Model } from 'arkormx'
import { Tenant } from './Tenant'
import { Project } from './Project'
import { User } from './User'
import { Permission } from './Permission'

export class UserPermission extends Model {
  protected static override table = 'user_permissions'

  declare id: string
  declare tenantId: string
  declare projectId: string | null
  declare userId: string
  declare permissionId: string
  declare createdAt: Date
  declare updatedAt: Date

  protected static override columns = {
    tenantId: 'tenant_id',
    projectId: 'project_id',
    userId: 'user_id',
    permissionId: 'permission_id',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }

  tenant() {
    return this.belongsTo(Tenant, 'tenantId')
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
