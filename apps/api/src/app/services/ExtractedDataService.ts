import type { ExtractedAddress, ExtractedData, ExtractedIdentity, OcrFields, PostalAddress } from '@arkyc/types'

import { AddressVerification } from '@app/models/AddressVerification'
import { OcrResult } from '@app/models/OcrResult'
import { VerificationSession } from '@app/models/VerificationSession'
import { piiAccess } from 'src/support/access'

/**
 * The extracted personal data a project may read for a session, gated by its
 * `pii` entitlement.
 *
 * Returns null unless the project holds a granted `pii` grant. Then only the
 * granted categories are included, and (for `after` timing) only once the
 * session has a final decision. This is the read side of the extended-access
 * PII capability; the entitlement itself is managed under extended access.
 *
 * @param session
 * @returns
 */
export async function buildExtractedData(session: VerificationSession): Promise<ExtractedData | null> {
  const access = await piiAccess({ organizationId: session.organizationId, projectId: session.projectId })
  if (!access) return null

  const categories = access.details?.categories ?? []
  const timing = access.details?.timing ?? 'after'
  // `after` withholds the data until the session is actually decided.
  if (timing === 'after' && session.finalDecision == null) return null

  const data: ExtractedData = {}

  if (categories.includes('identity')) {
    const ocr = await OcrResult.where({ sessionId: session.id }).first()
    if (ocr?.fields) data.identity = toIdentity(ocr.fields)
  }

  if (categories.includes('address')) {
    const address = await AddressVerification.where({ sessionId: session.id }).first()
    if (address) data.address = toAddress(address.claimedAddress, address.latitude, address.longitude)
  }

  return data.identity || data.address ? data : null
}

function toIdentity(fields: OcrFields): ExtractedIdentity {
  return {
    first_name: fields.firstName ?? null,
    last_name: fields.lastName ?? null,
    full_name: fields.fullName ?? null,
    date_of_birth: fields.dateOfBirth ?? null,
    document_number: fields.documentNumber ?? null,
    expiry_date: fields.expiryDate ?? null,
    nationality: fields.nationality ?? null,
  }
}

function toAddress(address: PostalAddress | null, latitude: number | null, longitude: number | null): ExtractedAddress {
  return {
    line1: address?.line1 ?? null,
    line2: address?.line2 ?? null,
    city: address?.city ?? null,
    region: address?.region ?? null,
    postal_code: address?.postalCode ?? null,
    country: address?.country ?? null,
    latitude: latitude ?? address?.latitude ?? null,
    longitude: longitude ?? address?.longitude ?? null,
  }
}
