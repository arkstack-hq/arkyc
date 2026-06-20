import { Model } from 'arkormx'
import { Tenant } from './Tenant'
import { Role } from './Role'

export class TenantInvitation extends Model {
    protected static override table = 'tenant_invitations'

    declare id: string
    declare tenantId: string
    declare email: string
    declare roleId: string
    declare tokenHash: string
    declare expiresAt: Date
    declare acceptedAt: Date | null
    declare createdAt: Date
    declare updatedAt: Date

    protected static override columns = {
        tenantId: 'tenant_id',
        roleId: 'role_id',
        tokenHash: 'token_hash',
        expiresAt: 'expires_at',
        acceptedAt: 'accepted_at',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    }

    tenant () {
        return this.belongsTo(Tenant, 'tenantId')
    }

    role () {
        return this.belongsTo(Role, 'roleId')
    }
}
