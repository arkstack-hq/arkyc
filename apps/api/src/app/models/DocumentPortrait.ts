import { Model } from 'arkormx'
import { Tenant } from './Tenant'
import { Project } from './Project'
import { VerificationSession } from './VerificationSession'
import { DocumentCapture } from './DocumentCapture'

export class DocumentPortrait extends Model {
  protected static override table = 'document_portraits'

  declare id: string
  declare tenantId: string
  declare projectId: string
  declare sessionId: string
  declare documentCaptureId: string
  declare portraitImagePath: string
  declare detectionConfidence: number
  declare createdAt: Date
  declare updatedAt: Date

  protected static override columns = {
    tenantId: 'tenant_id',
    projectId: 'project_id',
    sessionId: 'session_id',
    documentCaptureId: 'document_capture_id',
    portraitImagePath: 'portrait_image_path',
    detectionConfidence: 'detection_confidence',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }

  tenant() {
    return this.belongsTo(Tenant, 'tenantId')
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
