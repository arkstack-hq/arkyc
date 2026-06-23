import { Model } from 'arkormx'
import type { CastMap } from 'arkormx'
import type { OrganizationSettings } from '@arkyc/types'
import { Role } from './Role'
import { OrganizationMember } from './OrganizationMember'
import { OrganizationInvitation } from './OrganizationInvitation'
import { Project } from './Project'
import { ApiKey } from './ApiKey'
import { VerificationSession } from './VerificationSession'
import { WebhookEndpoint } from './WebhookEndpoint'
import { AuditLog } from './AuditLog'
import { OrganizationFactory } from 'src/database/factories/OrganizationFactory'

export class Organization extends Model {
  protected static override table = 'organizations'

  protected static override factoryClass = OrganizationFactory

  declare id: string
  declare name: string
  declare slug: string
  declare logoUrl: string | null
  declare settings: OrganizationSettings | null
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
    return this.hasMany(Role, 'organizationId')
  }

  members() {
    return this.hasMany(OrganizationMember, 'organizationId')
  }

  invitations() {
    return this.hasMany(OrganizationInvitation, 'organizationId')
  }

  projects() {
    return this.hasMany(Project, 'organizationId')
  }

  apiKeys() {
    return this.hasMany(ApiKey, 'organizationId')
  }

  sessions() {
    return this.hasMany(VerificationSession, 'organizationId')
  }

  webhookEndpoints() {
    return this.hasMany(WebhookEndpoint, 'organizationId')
  }

  auditLogs() {
    return this.hasMany(AuditLog, 'organizationId')
  }
}
