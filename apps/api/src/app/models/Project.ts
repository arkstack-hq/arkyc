import { Model } from 'arkormx'
import type { CastMap } from 'arkormx'
import type { ProjectBranding, ProjectEnvironment, ProjectSettings, ProjectStatus } from '@arkyc/types'
import { Tenant } from './Tenant'
import { ProjectMember } from './ProjectMember'
import { ApiKey } from './ApiKey'
import { VerificationSession } from './VerificationSession'
import { WebhookEndpoint } from './WebhookEndpoint'
import { ProjectFactory } from 'src/database/factories/ProjectFactory'

export class Project extends Model {
    protected static override table = 'projects'

    protected static override factoryClass = ProjectFactory

    declare id: string
    declare tenantId: string
    declare name: string
    declare slug: string
    declare environment: ProjectEnvironment
    declare settings: ProjectSettings | null
    declare branding: ProjectBranding | null
    declare status: ProjectStatus
    declare createdAt: Date
    declare updatedAt: Date

    protected static override columns = {
        tenantId: 'tenant_id',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    }

    protected override casts: CastMap = {
        settings: 'json',
        branding: 'json',
    }

    tenant () {
        return this.belongsTo(Tenant, 'tenantId')
    }

    members () {
        return this.hasMany(ProjectMember, 'projectId')
    }

    apiKeys () {
        return this.hasMany(ApiKey, 'projectId')
    }

    sessions () {
        return this.hasMany(VerificationSession, 'projectId')
    }

    webhookEndpoints () {
        return this.hasMany(WebhookEndpoint, 'projectId')
    }
}
