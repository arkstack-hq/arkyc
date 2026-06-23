import { Model } from 'arkormx'
import { Organization } from './Organization'
import { Permission } from './Permission'
import { RolePermission } from './RolePermission'
import { OrganizationMember } from './OrganizationMember'

export class Role extends Model {
  protected static override table = 'roles'

  declare id: string
  /** Null for platform-admin roles (`admin: true`); set for organization roles. */
  declare organizationId: string | null
  declare name: string
  declare slug: string
  declare description: string | null
  declare isSystem: boolean
  /** Platform-admin role (not organization-scoped). */
  declare admin: boolean
  declare createdAt: Date
  declare updatedAt: Date

  protected static override columns = {
    organizationId: 'organization_id',
    isSystem: 'is_system',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }

  organization() {
    return this.belongsTo(Organization, 'organizationId')
  }

  rolePermissions() {
    return this.hasMany(RolePermission, 'roleId')
  }

  /** Permissions granted to this role, resolved through the pivot table. */
  permissions() {
    return this.belongsToMany(Permission, 'role_permissions', 'role_id', 'permission_id')
  }

  members() {
    return this.hasMany(OrganizationMember, 'roleId')
  }
}
