import { Model } from 'arkormx'
import type { CastMap } from 'arkormx'
import type { SpoofSignals } from '@arkyc/types'
import { Tenant } from './Tenant'
import { Project } from './Project'
import { VerificationSession } from './VerificationSession'

export class LivenessCheck extends Model {
  protected static override table = 'liveness_checks'

  declare id: string
  declare tenantId: string
  declare projectId: string
  declare sessionId: string
  declare selfieImagePath: string | null
  declare videoPath: string | null
  declare score: number
  declare passed: boolean
  declare spoofSignals: SpoofSignals | null
  declare provider: string
  declare rawResponse: unknown
  declare createdAt: Date
  declare updatedAt: Date

  protected static override columns = {
    tenantId: 'tenant_id',
    projectId: 'project_id',
    sessionId: 'session_id',
    selfieImagePath: 'selfie_image_path',
    videoPath: 'video_path',
    spoofSignals: 'spoof_signals',
    rawResponse: 'raw_response',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }

  protected override casts: CastMap = {
    spoofSignals: 'json',
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
