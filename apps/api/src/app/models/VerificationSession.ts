import { Model } from 'arkormx'
import type { CastMap } from 'arkormx'
import type {
    DecisionReason,
    Metadata,
    VerificationDecision,
    VerificationStatus,
} from '@arkyc/types'
import { Tenant } from './Tenant'
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
    declare tenantId: string
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
    declare metadata: Metadata | null
    declare createdAt: Date
    declare updatedAt: Date

    protected static override columns = {
        tenantId: 'tenant_id',
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
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    }

    protected override casts: CastMap = {
        metadata: 'json',
    }

    /** The client token hash is internal and never serialised. */
    protected override hidden = ['clientTokenHash']

    tenant () {
        return this.belongsTo(Tenant, 'tenantId')
    }

    project () {
        return this.belongsTo(Project, 'projectId')
    }

    reviewer () {
        return this.belongsTo(User, 'reviewedBy')
    }

    documentCaptures () {
        return this.hasMany(DocumentCapture, 'sessionId')
    }

    ocrResults () {
        return this.hasMany(OcrResult, 'sessionId')
    }

    documentPortraits () {
        return this.hasMany(DocumentPortrait, 'sessionId')
    }

    livenessChecks () {
        return this.hasMany(LivenessCheck, 'sessionId')
    }

    faceMatchChecks () {
        return this.hasMany(FaceMatchCheck, 'sessionId')
    }

    reviews () {
        return this.hasMany(Review, 'sessionId')
    }

    reviewNotes () {
        return this.hasMany(ReviewNote, 'sessionId')
    }
}
