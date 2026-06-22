import { Model } from 'arkormx'
import { User } from './User'
import { Permission } from './Permission'
import { Role } from './Role'

/**
 * A platform-admin grant to a user. Mirrors {@link UserPermission} but without
 * tenant/project scope: a row is EITHER a role grant (`roleId` set) or a direct
 * permission grant (`permissionId` set). Effective admin access is the union of
 * both — resolved by `ArkormPermissionStore` for the `canAdmin` guard.
 */
export class AdminPermission extends Model {
  protected static override table = 'admin_permissions'

  declare id: string
  declare userId: string
  declare permissionId: string | null
  declare roleId: string | null
  declare createdAt: Date
  declare updatedAt: Date

  protected static override columns = {
    userId: 'user_id',
    permissionId: 'permission_id',
    roleId: 'role_id',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }

  user() {
    return this.belongsTo(User, 'userId')
  }

  permission() {
    return this.belongsTo(Permission, 'permissionId')
  }

  role() {
    return this.belongsTo(Role, 'roleId')
  }
}
