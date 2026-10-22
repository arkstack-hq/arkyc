import { Model } from 'arkormx'
import type { BusinessVerificationDocument, BusinessVerificationReviewStatus } from '@arkyc/types'
import { Organization } from './Organization'
import { User } from './User'

/** One business verification submission and its review. */
export class BusinessVerification extends Model {
  protected static override table = 'business_verifications'

  declare id: string
  declare organizationId: string
  declare status: BusinessVerificationReviewStatus
  declare legalName: string
  declare country: string
  declare registrationNumber: string
  declare registeredAddress: string
  declare website: string
  declare dpoName: string
  declare dpoEmail: string
  declare privacyPolicyUrl: string
  declare dataProtectionRegistration: string | null
  declare incorporationDocumentPath: string | null
  declare dataProtectionDocumentPath: string | null
  declare reviewNote: string | null
  declare submittedBy: string | null
  declare submittedAt: Date
  declare reviewedBy: string | null
  declare reviewedAt: Date | null
  declare createdAt: Date
  declare updatedAt: Date

  protected static override columns = {
    organizationId: 'organization_id',
    legalName: 'legal_name',
    registrationNumber: 'registration_number',
    registeredAddress: 'registered_address',
    dpoName: 'dpo_name',
    dpoEmail: 'dpo_email',
    privacyPolicyUrl: 'privacy_policy_url',
    dataProtectionRegistration: 'data_protection_registration',
    incorporationDocumentPath: 'incorporation_document_path',
    dataProtectionDocumentPath: 'data_protection_document_path',
    reviewNote: 'review_note',
    submittedBy: 'submitted_by',
    submittedAt: 'submitted_at',
    reviewedBy: 'reviewed_by',
    reviewedAt: 'reviewed_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }

  organization() {
    return this.belongsTo(Organization, 'organizationId')
  }

  submitter() {
    return this.belongsTo(User, 'submittedBy')
  }

  reviewer() {
    return this.belongsTo(User, 'reviewedBy')
  }

  /** Stored path of an uploaded document, or `null`. */
  documentPath(kind: BusinessVerificationDocument): string | null {
    return kind === 'incorporation' ? this.incorporationDocumentPath : this.dataProtectionDocumentPath
  }

  /** Which documents were uploaded. */
  documents(): BusinessVerificationDocument[] {
    return (['incorporation', 'data_protection'] as const).filter((kind) => !!this.documentPath(kind))
  }
}
