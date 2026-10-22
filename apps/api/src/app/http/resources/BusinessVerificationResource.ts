import { Resource } from 'resora'
import type { BusinessVerification } from '@app/models/BusinessVerification'

/**
 * A submission as the API returns it. Stored document paths stay internal; only
 * which documents exist is exposed.
 *
 * @param verification
 * @returns
 */
export function verificationPayload(verification: BusinessVerification) {
  return {
    id: verification.id,
    organization_id: verification.organizationId,
    status: verification.status,
    legal_name: verification.legalName,
    country: verification.country,
    registration_number: verification.registrationNumber,
    registered_address: verification.registeredAddress,
    website: verification.website,
    dpo_name: verification.dpoName,
    dpo_email: verification.dpoEmail,
    privacy_policy_url: verification.privacyPolicyUrl,
    data_protection_registration: verification.dataProtectionRegistration ?? null,
    documents: verification.documents(),
    review_note: verification.reviewNote ?? null,
    submitted_by: verification.submittedBy ?? null,
    submitted_at: verification.submittedAt,
    reviewed_by: verification.reviewedBy ?? null,
    reviewed_at: verification.reviewedAt ?? null,
  }
}

/** A business verification submission, with its organization when loaded. */
export default class BusinessVerificationResource extends Resource {
  data() {
    const verification = this.resource as BusinessVerification
    const organization = verification.getAttribute('organization') as
      | { id: string; name: string; slug: string; verificationStatus: string }
      | undefined

    return {
      ...verificationPayload(verification),
      organization: organization
        ? {
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
            verification_status: organization.verificationStatus,
          }
        : undefined,
    }
  }
}
