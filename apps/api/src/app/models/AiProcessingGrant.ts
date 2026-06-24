import { Model } from 'arkormx'
import { Organization } from './Organization'
import { Project } from './Project'
import { User } from './User'

/** Lifecycle of a project's AI-processing access. No row ⇒ never requested. */
export type AiProcessingStatus = 'pending' | 'granted' | 'revoked'

/**
 * Per-project AI document-processing access. AI OCR is gated: project owners
 * request it, platform admins grant or revoke it. `aiOcrEnabledForProject`
 * (see `src/support/ai-access`) treats only `granted` as enabled.
 */
export class AiProcessingGrant extends Model {
  protected static override table = 'ai_processing_grants'

  declare id: string
  declare organizationId: string
  declare projectId: string
  declare status: AiProcessingStatus
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
