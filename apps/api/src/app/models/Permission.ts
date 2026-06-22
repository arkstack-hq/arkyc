import { Model } from 'arkormx'
import type { AnyPermissionGroup, AnyPermissionKey } from '@arkyc/types'
import { RolePermission } from './RolePermission'

export class Permission extends Model {
  protected static override table = 'permissions'

  declare id: string
  declare name: AnyPermissionKey
  declare description: string | null
  declare group: AnyPermissionGroup
  /** Platform-scope permission (gates the super-admin surface). */
  declare admin: boolean
  declare createdAt: Date
  declare updatedAt: Date

  protected static override columns = {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }

  rolePermissions() {
    return this.hasMany(RolePermission, 'permissionId')
  }
}
