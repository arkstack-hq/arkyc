import { Model } from 'arkormx'
import type { CastMap } from 'arkormx'
import type { RiskSeverity, RiskSignal, RiskSignalKey } from '@arkyc/types'
import { VerificationSession } from './VerificationSession'

/** A fraud or compliance signal raised against a session, optionally cleared by a reviewer. */
export class SessionRiskSignal extends Model {
  protected static override table = 'session_risk_signals'

  declare id: string
  declare organizationId: string
  declare projectId: string
  declare sessionId: string
  declare key: RiskSignalKey
  declare severity: RiskSeverity
  declare score: number
  declare advisory: boolean
  declare source: string
  declare evidence: Record<string, unknown> | null
  declare clearedAt: Date | null
  declare clearedBy: string | null
  declare clearReason: string | null
  declare createdAt: Date
  declare updatedAt: Date

  protected static override columns = {
    organizationId: 'organization_id',
    projectId: 'project_id',
    sessionId: 'session_id',
    clearedAt: 'cleared_at',
    clearedBy: 'cleared_by',
    clearReason: 'clear_reason',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }

  protected override casts: CastMap = {
    evidence: 'json',
  }

  session() {
    return this.belongsTo(VerificationSession, 'sessionId')
  }

  /** The signal as the decision engine reads it. A cleared signal no longer counts. */
  toSignal(): RiskSignal {
    return {
      key: this.key,
      severity: this.clearedAt ? 'info' : this.severity,
      score: this.score,
      advisory: this.advisory,
      evidence: this.evidence ?? {},
    }
  }
}
