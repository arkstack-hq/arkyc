import { Model } from 'arkormx'
import { Organization } from './Organization'
import { Project } from './Project'
import { VerificationSession } from './VerificationSession'
import { User } from './User'

export class ReviewNote extends Model {
  protected static override table = 'review_notes'

  declare id: string
  declare organizationId: string
  declare projectId: string
  declare sessionId: string
  declare reviewerId: string
  declare note: string
  declare createdAt: Date
  declare updatedAt: Date

  protected static override columns = {
    organizationId: 'organization_id',
    projectId: 'project_id',
    sessionId: 'session_id',
    reviewerId: 'reviewer_id',
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
