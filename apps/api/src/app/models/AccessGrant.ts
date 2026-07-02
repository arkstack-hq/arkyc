import type { AccessCapability, AccessGrantDetails, AccessGrantStatus } from '@arkyc/types'

import type { CastMap } from 'arkormx'
import { Model } from 'arkormx'
import { Organization } from './Organization'
import { Project } from './Project'
import { User } from './User'

/** A stored access-grant status (the synthetic `none` is never persisted). */
export type StoredAccessGrantStatus = Exclude<AccessGrantStatus, 'none'>

/**
 * Per-`(project, capability)` extended-access entitlement. Gated capabilities
 * (`ai`, `pii`, …) are requested by project owners and granted or revoked by
 * platform admins. `entitlementGranted` (see `src/support/access`) treats only
 * `granted` as enabled. `details` carries capability-specific request data (PII:
 * categories, timing, justification).
 */
export class AccessGrant extends Model {
  protected static override table = 'access_grants'

  declare id: string
  declare organizationId: string
  declare projectId: string
  declare capability: AccessCapability
  declare status: StoredAccessGrantStatus
  declare details: AccessGrantDetails | null
  declare note: string | null
  declare requestedBy: string | null
  declare requestedAt: Date | null
  declare reviewedBy: string | null
  declare reviewedAt: Date | null
  declare createdAt: Date
  declare updatedAt: Date

  protected static override columns = {
    organizationId: 'organization_id',
    projectId: 'project_id',
    requestedBy: 'requested_by',
    requestedAt: 'requested_at',
    reviewedBy: 'reviewed_by',
    reviewedAt: 'reviewed_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }

  protected override casts: CastMap = {
    details: 'json',
  }

  organization() {
    return this.belongsTo(Organization, 'organizationId')
  }

  project() {
    return this.belongsTo(Project, 'projectId')
  }

  requester() {
    return this.belongsTo(User, 'requestedBy')
  }

  reviewer() {
    return this.belongsTo(User, 'reviewedBy')
  }
}
