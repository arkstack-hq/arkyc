import { Model } from 'arkormx'
import { Tenant } from './Tenant'
import { Permission } from './Permission'
import { RolePermission } from './RolePermission'
import { TenantMember } from './TenantMember'

export class Role extends Model {
    protected static override table = 'roles'

    declare id: string
    declare tenantId: string
    declare name: string
    declare slug: string
    declare description: string | null
    declare isSystem: boolean
    declare createdAt: Date
    declare updatedAt: Date

    protected static override columns = {
        tenantId: 'tenant_id',
        isSystem: 'is_system',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    }

    tenant () {
        return this.belongsTo(Tenant, 'tenantId')
    }

    rolePermissions () {
        return this.hasMany(RolePermission, 'roleId')
    }

    /** Permissions granted to this role, resolved through the pivot table. */
    permissions () {
        return this.belongsToMany(Permission, 'role_permissions', 'roleId', 'permissionId')
    }

    members () {
        return this.hasMany(TenantMember, 'roleId')
    }
}
