import { Model } from 'arkormx'
import type { CastMap } from 'arkormx'
import type { OcrFields } from '@arkyc/types'
import { Organization } from './Organization'
import { Project } from './Project'
import { VerificationSession } from './VerificationSession'
import { DocumentCapture } from './DocumentCapture'

export class OcrResult extends Model {
  protected static override table = 'ocr_results'

  declare id: string
  declare organizationId: string
  declare projectId: string
  declare sessionId: string
  declare documentCaptureId: string
  declare fields: OcrFields
  declare confidence: number
  declare rawResponse: unknown
  declare createdAt: Date
  declare updatedAt: Date

  protected static override columns = {
    organizationId: 'organization_id',
    projectId: 'project_id',
    sessionId: 'session_id',
    documentCaptureId: 'document_capture_id',
    rawResponse: 'raw_response',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }

  protected override casts: CastMap = {
    fields: 'json',
    rawResponse: 'json',
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
