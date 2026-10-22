import type { BusinessVerification, BusinessVerificationDocument, BusinessVerificationStatus } from '@arkyc/types'
import { CACHE, type Paginated, alova, fetchProtectedBlob, params, t, unwrap } from './client'

/** The active organization's verification standing. */
export interface VerificationState {
  status: BusinessVerificationStatus
  verified_at: string | null
  /** Whether the platform requires verification before production. */
  required: boolean
  can_go_live: boolean
  latest: BusinessVerification | null
}

/** A submission in the admin queue, with its organization. */
export type AdminBusinessVerification = BusinessVerification & {
  organization?: { id: string; name: string; slug: string; verification_status: BusinessVerificationStatus }
}

const DECISIONS = ['business_verification:submit', 'business_verification:decide']

/** Business verification for the active organization, and its admin review. */
export class BusinessVerifications {
  static state(organizationId: string) {
    return alova.Get(`${t(organizationId)}/verification`, {
      name: 'business_verification:state',
      cacheFor: CACHE,
      hitSource: DECISIONS,
      transform: unwrap<VerificationState>,
    })
  }

  /** Submit details and documents (multipart). */
  static submit(organizationId: string, form: FormData) {
    return alova.Post(`${t(organizationId)}/verification`, form, {
      name: 'business_verification:submit',
      transform: unwrap<BusinessVerification>,
    })
  }

  /** Object URL of a document from the latest submission. */
  static document(organizationId: string, kind: BusinessVerificationDocument) {
    return fetchProtectedBlob(`${t(organizationId)}/verification/documents/${kind}`)
  }

  static adminList(query?: { status?: string; page?: number; limit?: number }) {
    return alova.Get<Paginated<AdminBusinessVerification>>('/v1/admin/business-verifications', {
      name: 'admin:business_verifications',
      cacheFor: CACHE,
      hitSource: DECISIONS,
      params: params(query as Record<string, unknown>),
    })
  }

  /** Submissions awaiting review (drives the nav badge). */
  static adminPendingCount() {
    return alova.Get('/v1/admin/business-verifications/count', {
      name: 'admin:business_verifications:count',
      hitSource: DECISIONS,
      transform: (envelope: { data?: { count: number } }) => envelope.data?.count ?? 0,
    })
  }

  static adminGet(id: string) {
    return alova.Get(`/v1/admin/business-verifications/${id}`, {
      name: 'admin:business_verification',
      cacheFor: CACHE,
      hitSource: DECISIONS,
      transform: unwrap<AdminBusinessVerification>,
    })
  }

  static adminDocument(id: string, kind: BusinessVerificationDocument) {
    return fetchProtectedBlob(`/v1/admin/business-verifications/${id}/documents/${kind}`)
  }

  static approve(id: string, note?: string) {
    return alova.Patch(`/v1/admin/business-verifications/${id}/approve`, note ? { note } : {}, {
      name: 'business_verification:decide',
    })
  }

  static reject(id: string, note: string) {
    return alova.Patch(
      `/v1/admin/business-verifications/${id}/reject`,
      { note },
      {
        name: 'business_verification:decide',
      },
    )
  }

  /** Mark an organization verified or unverified directly (platform admins). */
  static setOrganization(organizationId: string, verified: boolean) {
    return alova.Patch(
      `/v1/admin/organizations/${organizationId}/verification`,
      { verified },
      {
        name: 'business_verification:decide',
      },
    )
  }
}
