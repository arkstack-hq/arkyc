import { RequestException } from '@arkstack/common'
import { type FileLike, Storage } from '@arkstack/filesystem'
import type { BusinessVerificationDetails, BusinessVerificationDocument } from '@arkyc/types'
import { BusinessVerification } from '@app/models/BusinessVerification'
import { Organization } from '@app/models/Organization'
import { Project } from '@app/models/Project'
import { organizationNotifications } from '@app/notifications/OrganizationNotifications'
import { settings } from '@app/services/GlobalSettingsService'
import { ApiException } from 'src/support/apiErrors'

/**
 * Business verification: organizations prove they may handle personal data
 * before verifying identities in production. Development and staging projects
 * stay open; platform admins review each submission.
 */
export class BusinessVerificationService {
  /**
   * The organization's most recent submission, or `null`.
   *
   * @param organizationId
   * @returns
   */
  async latest(organizationId: string): Promise<BusinessVerification | null> {
    return await BusinessVerification.where({ organizationId }).latest('createdAt').first()
  }

  /**
   * Record a submission with its documents and put the organization under review.
   *
   * @param organization
   * @param submittedBy
   * @param details
   * @param documents
   * @returns
   */
  async submit(
    organization: Organization,
    submittedBy: string,
    details: BusinessVerificationDetails,
    documents: Partial<Record<BusinessVerificationDocument, FileLike>>,
  ): Promise<BusinessVerification> {
    RequestException.abortIf(
      organization.verificationStatus === 'pending' || organization.verificationStatus === 'verified',
      organization.verificationStatus === 'pending'
        ? 'A verification is already under review'
        : 'This organization is already verified',
      409,
    )

    const verification = await BusinessVerification.create({
      organizationId: organization.id,
      status: 'pending',
      legalName: details.legal_name,
      country: details.country.toUpperCase(),
      registrationNumber: details.registration_number,
      registeredAddress: details.registered_address,
      website: details.website,
      dpoName: details.dpo_name,
      dpoEmail: details.dpo_email,
      privacyPolicyUrl: details.privacy_policy_url,
      dataProtectionRegistration: details.data_protection_registration,
      submittedBy,
      submittedAt: new Date(),
    })

    verification.incorporationDocumentPath = await this.store(verification, 'incorporation', documents.incorporation)
    verification.dataProtectionDocumentPath = await this.store(
      verification,
      'data_protection',
      documents.data_protection,
    )
    await verification.save()

    organization.verificationStatus = 'pending'
    await organization.save()

    return verification
  }

  /**
   * Approve or reject a pending submission, update the organization and tell its managers.
   *
   * @param verification
   * @param decision
   * @param reviewerId
   * @param note
   */
  async decide(
    verification: BusinessVerification,
    decision: 'approved' | 'rejected',
    reviewerId: string,
    note: string | null,
  ): Promise<void> {
    RequestException.abortIf(verification.status !== 'pending', 'This verification was already decided', 409)

    verification.status = decision
    verification.reviewedBy = reviewerId
    verification.reviewedAt = new Date()
    verification.reviewNote = note
    await verification.save()

    const organization = await Organization.where({ id: verification.organizationId }).firstOrFail()
    organization.verificationStatus = decision === 'approved' ? 'verified' : 'rejected'
    organization.verifiedAt = decision === 'approved' ? new Date() : null
    await organization.save()

    await organizationNotifications.verificationDecided(organization, decision, note, reviewerId)
  }

  /**
   * Set an organization's status directly, without a submission (platform admins only).
   *
   * @param organization
   * @param verified
   */
  async setVerified(organization: Organization, verified: boolean): Promise<void> {
    organization.verificationStatus = verified ? 'verified' : 'unverified'
    organization.verifiedAt = verified ? new Date() : null
    await organization.save()
  }

  /**
   * Whether the organization may run production projects.
   *
   * @param organization
   * @returns
   */
  async canGoLive(organization: Pick<Organization, 'verificationStatus'>): Promise<boolean> {
    if (organization.verificationStatus === 'verified') return true

    return !(await settings.current()).compliance.business_verification_required
  }

  /**
   * Refuse to start a session on a production project of an unverified organization.
   *
   * @param projectId
   */
  async assertCanVerify(projectId: string): Promise<void> {
    const project = await Project.where({ id: projectId }).with('organization').firstOrFail()
    if (project.environment !== 'production') return

    const organization = project.getAttribute('organization') as Organization | null
    if (organization && !(await this.canGoLive(organization))) throw new ApiException('organization_unverified')
  }

  private async store(
    verification: BusinessVerification,
    kind: BusinessVerificationDocument,
    file: FileLike | undefined,
  ): Promise<string | null> {
    if (!file) return null

    const ext = file.mimetype === 'application/pdf' ? 'pdf' : file.mimetype === 'image/png' ? 'png' : 'jpg'
    const key = `organizations/${verification.organizationId}/verification/${verification.id}/${kind}.${ext}`
    await Storage.disk().put(key, file, { visibility: 'private', contentType: file.mimetype })

    return key
  }
}

/** Shared singleton. */
export const businessVerifications = new BusinessVerificationService()
