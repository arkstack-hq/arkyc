import { Model } from 'arkormx'
import type { MembershipStatus } from '@arkyc/types'
import { Tenant } from './Tenant'
import { Role } from './Role'
import { User } from './User'

export class TenantMember extends Model {
    protected static override table = 'tenant_members'

    declare id: string
    declare tenantId: string
    declare userId: string
    declare roleId: string
    declare status: MembershipStatus
    declare joinedAt: Date | null
    declare createdAt: Date
    declare updatedAt: Date

    protected static override columns = {
        tenantId: 'tenant_id',
        userId: 'user_id',
        roleId: 'role_id',
        joinedAt: 'joined_at',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    }

    tenant () {
        return this.belongsTo(Tenant, 'tenantId')
    }

    user () {
        return this.belongsTo(User, 'userId')
    }

    role () {
        return this.belongsTo(Role, 'roleId')
    }
}
