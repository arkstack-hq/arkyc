import { Model } from 'arkormx'
import type { CastMap } from 'arkormx'
import type {
  CaptureModel,
  DecisionReason,
  LivenessChallenge,
  Metadata,
  VerificationDecision,
  VerificationStatus,
  WorkflowConfig,
} from '@arkyc/types'
import { Organization } from './Organization'
import { Project } from './Project'
import { User } from './User'
import { DocumentCapture } from './DocumentCapture'
import { OcrResult } from './OcrResult'
import { DocumentPortrait } from './DocumentPortrait'
import { LivenessCheck } from './LivenessCheck'
import { FaceMatchCheck } from './FaceMatchCheck'
import { Review } from './Review'
import { ReviewNote } from './ReviewNote'
import { VerificationSessionFactory } from 'src/database/factories/VerificationSessionFactory'

export class VerificationSession extends Model {
  protected static override table = 'verification_sessions'

  protected static override factoryClass = VerificationSessionFactory

  declare id: string
  declare organizationId: string
  declare projectId: string
  declare userReference: string | null
  declare status: VerificationStatus
  declare autoDecision: VerificationDecision | null
  declare finalDecision: VerificationDecision | null
  declare decisionReason: DecisionReason | null
  declare riskScore: number | null
  declare clientTokenHash: string | null
  declare expiresAt: Date
  declare completedAt: Date | null
  declare reviewedAt: Date | null
  declare reviewedBy: string | null
  declare assignedTo: string | null
  declare metadata: Metadata | null
  /** Resolved capture flow for this session (project override > global setting). */
  declare captureModel: CaptureModel | null
  /** Randomized active-liveness challenge sequence issued at session creation. */
  declare livenessChallenges: LivenessChallenge[] | null
  /** The workflow applied to this session, if any (its ID for traceability). */
  declare workflowId: string | null
  /** Snapshot of the applied workflow config, frozen at session creation. */
  declare workflow: WorkflowConfig | null
  declare createdAt: Date
  declare updatedAt: Date

  protected static override columns = {
    organizationId: 'organization_id',
    projectId: 'project_id',
    userReference: 'user_reference',
    autoDecision: 'auto_decision',
    finalDecision: 'final_decision',
    decisionReason: 'decision_reason',
    riskScore: 'risk_score',
    clientTokenHash: 'client_token_hash',
    expiresAt: 'expires_at',
    completedAt: 'completed_at',
    reviewedAt: 'reviewed_at',
    reviewedBy: 'reviewed_by',
    assignedTo: 'assigned_to',
    captureModel: 'capture_model',
    livenessChallenges: 'liveness_challenges',
    workflowId: 'workflow_id',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }

  protected override casts: CastMap = {
    metadata: 'json',
    livenessChallenges: 'json',
    workflow: 'json',
  }

  /** The client token hash is internal and never serialised. */
  protected override hidden = ['clientTokenHash']

  organization() {
    return this.belongsTo(Organization, 'organizationId')
  }

  project() {
    return this.belongsTo(Project, 'projectId')
  }

  reviewer() {
    return this.belongsTo(User, 'reviewedBy')
  }

  documentCaptures() {
    return this.hasMany(DocumentCapture, 'sessionId')
  }

  ocrResults() {
    return this.hasMany(OcrResult, 'sessionId')
  }

  documentPortraits() {
    return this.hasMany(DocumentPortrait, 'sessionId')
  }

  livenessChecks() {
    return this.hasMany(LivenessCheck, 'sessionId')
  }

  faceMatchChecks() {
    return this.hasMany(FaceMatchCheck, 'sessionId')
  }

  reviews() {
    return this.hasMany(Review, 'sessionId')
  }

  reviewNotes() {
    return this.hasMany(ReviewNote, 'sessionId')
  }
}
