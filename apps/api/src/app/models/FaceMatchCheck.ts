import { Model } from 'arkormx'
import type { CastMap } from 'arkormx'
import { Tenant } from './Tenant'
import { Project } from './Project'
import { VerificationSession } from './VerificationSession'

export class FaceMatchCheck extends Model {
  protected static override table = 'face_match_checks'

  declare id: string
  declare tenantId: string
  declare projectId: string
  declare sessionId: string
  declare idPortraitImagePath: string | null
  declare selfieImagePath: string | null
  declare similarityScore: number
  declare confidence: number
  declare passed: boolean
  declare provider: string
  declare rawResponse: unknown
  declare createdAt: Date
  declare updatedAt: Date

  protected static override columns = {
    tenantId: 'tenant_id',
    projectId: 'project_id',
    sessionId: 'session_id',
    idPortraitImagePath: 'id_portrait_image_path',
    selfieImagePath: 'selfie_image_path',
    similarityScore: 'similarity_score',
    rawResponse: 'raw_response',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }

  protected override casts: CastMap = {
    rawResponse: 'json',
    passed: 'boolean',
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
}
