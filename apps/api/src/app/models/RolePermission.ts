import { Model } from 'arkormx'
import { Role } from './Role'
import { Permission } from './Permission'

export class RolePermission extends Model {
    protected static override table = 'role_permissions'

    declare id: string
    declare roleId: string
    declare permissionId: string
    declare createdAt: Date
    declare updatedAt: Date

    protected static override columns = {
        roleId: 'role_id',
        permissionId: 'permission_id',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    }

    role () {
        return this.belongsTo(Role, 'roleId')
    }

    permission () {
        return this.belongsTo(Permission, 'permissionId')
    }
}
