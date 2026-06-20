import { Model } from 'arkormx'
import type { PermissionGroup, PermissionKey } from '@arkyc/types'
import { RolePermission } from './RolePermission'

export class Permission extends Model {
    protected static override table = 'permissions'

    declare id: string
    declare name: PermissionKey
    declare description: string | null
    declare group: PermissionGroup
    declare createdAt: Date
    declare updatedAt: Date

    protected static override columns = {
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    }

    rolePermissions () {
        return this.hasMany(RolePermission, 'permissionId')
    }
}
