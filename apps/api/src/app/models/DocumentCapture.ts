import { Model } from 'arkormx'
import type { DocumentType } from '@arkyc/types'
import { Organization } from './Organization'
import { Project } from './Project'
import { VerificationSession } from './VerificationSession'
import { OcrResult } from './OcrResult'
import { DocumentPortrait } from './DocumentPortrait'

export class DocumentCapture extends Model {
  protected static override table = 'document_captures'

  declare id: string
  declare organizationId: string
  declare projectId: string
  declare sessionId: string
  declare country: string | null
  declare documentType: DocumentType | null
  declare frontImagePath: string | null
  declare backImagePath: string | null
  declare qualityScore: number | null
  declare createdAt: Date
  declare updatedAt: Date

  protected static override columns = {
    organizationId: 'organization_id',
    projectId: 'project_id',
    sessionId: 'session_id',
    documentType: 'document_type',
    frontImagePath: 'front_image_path',
    backImagePath: 'back_image_path',
    qualityScore: 'quality_score',
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

  ocrResults() {
    return this.hasMany(OcrResult, 'documentCaptureId')
  }

  portraits() {
    return this.hasMany(DocumentPortrait, 'documentCaptureId')
  }
}
