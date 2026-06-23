import { Model } from 'arkormx'
import { Organization } from './Organization'
import { Project } from './Project'
import { VerificationSession } from './VerificationSession'
import { DocumentCapture } from './DocumentCapture'

export class DocumentPortrait extends Model {
  protected static override table = 'document_portraits'

  declare id: string
  declare organizationId: string
  declare projectId: string
  declare sessionId: string
  declare documentCaptureId: string
  declare portraitImagePath: string
  declare detectionConfidence: number
  declare createdAt: Date
  declare updatedAt: Date

  protected static override columns = {
    organizationId: 'organization_id',
    projectId: 'project_id',
    sessionId: 'session_id',
    documentCaptureId: 'document_capture_id',
    portraitImagePath: 'portrait_image_path',
    detectionConfidence: 'detection_confidence',
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

  documentCapture() {
    return this.belongsTo(DocumentCapture, 'documentCaptureId')
  }
}
