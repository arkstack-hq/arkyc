import { Model } from 'arkormx'
import type { CastMap } from 'arkormx'
import type { TenantSettings } from '@arkyc/types'
import { Role } from './Role'
import { TenantMember } from './TenantMember'
import { TenantInvitation } from './TenantInvitation'
import { Project } from './Project'
import { ApiKey } from './ApiKey'
import { VerificationSession } from './VerificationSession'
import { WebhookEndpoint } from './WebhookEndpoint'
import { AuditLog } from './AuditLog'
import { TenantFactory } from 'src/database/factories/TenantFactory'

export class Tenant extends Model {
  protected static override table = 'tenants'

  protected static override factoryClass = TenantFactory

  declare id: string
  declare name: string
  declare slug: string
  declare logoUrl: string | null
  declare settings: TenantSettings | null
  declare createdAt: Date
  declare updatedAt: Date

  protected static override columns = {
    logoUrl: 'logo_url',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }

  protected override casts: CastMap = {
    settings: 'json',
  }

  roles() {
    return this.hasMany(Role, 'tenantId')
  }

  members() {
    return this.hasMany(TenantMember, 'tenantId')
  }

  invitations() {
    return this.hasMany(TenantInvitation, 'tenantId')
  }

  projects() {
    return this.hasMany(Project, 'tenantId')
  }

  apiKeys() {
    return this.hasMany(ApiKey, 'tenantId')
  }

  sessions() {
    return this.hasMany(VerificationSession, 'tenantId')
  }

  webhookEndpoints() {
    return this.hasMany(WebhookEndpoint, 'tenantId')
  }

  auditLogs() {
    return this.hasMany(AuditLog, 'tenantId')
  }
}
