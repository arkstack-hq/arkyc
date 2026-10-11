import { Model } from 'arkormx'

export type FingerprintKind = 'document' | 'identity'

/** A keyed hash of a session's document or identity, matched across an organization's sessions. */
export class SessionFingerprint extends Model {
  protected static override table = 'session_fingerprints'

  declare id: string
  declare organizationId: string
  declare projectId: string
  declare sessionId: string
  declare kind: FingerprintKind
  declare hash: string
  declare userReference: string | null
  declare createdAt: Date
  declare updatedAt: Date

  protected static override columns = {
    organizationId: 'organization_id',
    projectId: 'project_id',
    sessionId: 'session_id',
    userReference: 'user_reference',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
}
