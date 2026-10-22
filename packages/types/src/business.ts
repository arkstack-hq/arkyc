import type { Id, IsoDateTime } from './common'

/** Where an organization stands on business verification. */
export type BusinessVerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected'

/** A submission's review state. */
export type BusinessVerificationReviewStatus = 'pending' | 'approved' | 'rejected'

/** Documents an organization uploads to prove it may handle personal data. */
export type BusinessVerificationDocument = 'incorporation' | 'data_protection'

/**
 * The business details an organization submits before it can verify identities
 * in production. Every organization is treated as a business.
 */
export interface BusinessVerificationDetails {
  legal_name: string
  /** ISO 3166-1 alpha-2 country of registration. */
  country: string
  registration_number: string
  registered_address: string
  website: string
  /** Data protection officer, or whoever answers for personal data. */
  dpo_name: string
  dpo_email: string
  privacy_policy_url: string
  /** Registration with a data protection authority, when the country requires one. */
  data_protection_registration: string | null
}

/** One verification submission and its review, as the API returns it. */
export interface BusinessVerification extends BusinessVerificationDetails {
  id: Id
  organization_id: Id
  status: BusinessVerificationReviewStatus
  /** Which documents were uploaded. */
  documents: BusinessVerificationDocument[]
  review_note: string | null
  submitted_by: Id | null
  submitted_at: IsoDateTime
  reviewed_by: Id | null
  reviewed_at: IsoDateTime | null
}
