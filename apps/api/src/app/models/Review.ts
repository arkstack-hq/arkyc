import { Model } from 'arkormx'
import type { VerificationStatus } from '@arkyc/types'
import { Organization } from './Organization'
import { Project } from './Project'
import { VerificationSession } from './VerificationSession'
import { User } from './User'

export class Review extends Model {
  protected static override table = 'reviews'

  declare id: string
  declare organizationId: string
  declare projectId: string
  declare sessionId: string
  declare reviewerId: string | null
  declare previousStatus: VerificationStatus
  declare newStatus: VerificationStatus
  declare reason: string | null
  declare note: string | null
  declare createdAt: Date
  declare updatedAt: Date

  protected static override columns = {
    organizationId: 'organization_id',
    projectId: 'project_id',
    sessionId: 'session_id',
    reviewerId: 'reviewer_id',
    previousStatus: 'previous_status',
    newStatus: 'new_status',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }

  organization() {
    return this.belongsTo(Organization, 'organizationId')
  }

  project() {
    return this.belongsTo(Project, 'projectId')
  }

  session() {
    return this.belongsTo(VerificationSession, 'sessionId')
  }

  reviewer() {
    return this.belongsTo(User, 'reviewerId')
  }
}
