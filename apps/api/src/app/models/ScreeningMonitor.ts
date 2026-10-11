import { Model } from 'arkormx'
import type { CastMap } from 'arkormx'
import { VerificationSession } from './VerificationSession'

/** A completed session whose identity is re-screened on a schedule. */
export class ScreeningMonitor extends Model {
  protected static override table = 'screening_monitors'

  declare id: string
  declare organizationId: string
  declare projectId: string
  declare sessionId: string
  declare threshold: number
  /** Entities already raised for this session, so a re-screen only reports new ones. */
  declare knownEntityIds: string[] | null
  declare active: boolean
  declare lastScreenedAt: Date | null
  declare nextScreenAt: Date
  declare createdAt: Date
  declare updatedAt: Date

  protected static override columns = {
    organizationId: 'organization_id',
    projectId: 'project_id',
    sessionId: 'session_id',
    knownEntityIds: 'known_entity_ids',
    lastScreenedAt: 'last_screened_at',
    nextScreenAt: 'next_screen_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }

  protected override casts: CastMap = {
    knownEntityIds: 'json',
  }

  session() {
    return this.belongsTo(VerificationSession, 'sessionId')
  }
}
