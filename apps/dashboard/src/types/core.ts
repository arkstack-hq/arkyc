import { type VerificationDecision, type VerificationStatus } from '@arkyc/types'
export interface GenericApiResponsePayload {
  status: string
  code: number
  message: string
  errors?: Record<string, string[]>
}

/** The dashboard session-detail payload (base session + checks + media). */
export interface SessionDetail {
  id: string
  project_id: string
  user_reference?: string | null
  status: VerificationStatus
  auto_decision?: VerificationDecision | null
  final_decision?: VerificationDecision | null
  decision_reason?: string | null
  risk_score?: number | null
  reviewed_at?: string | null
  completed_at?: string | null
  created_at: string
  expires_at: string
  ocr?: { fields?: Record<string, unknown> | null; confidence?: number | null } | null
  document?: { country?: string | null; document_type?: string | null; quality_score?: number | null } | null
  liveness?: { score?: number | null; passed?: boolean | null; spoof_signals?: Record<string, unknown> | null } | null
  face_match?: { similarity_score?: number | null; confidence?: number | null; passed?: boolean | null } | null
  address?: {
    passed?: boolean | null
    score?: number | null
    claimed_address?: Record<string, unknown> | null
    methods?:
      | {
          method: string
          passed: boolean
          confidence: number
          /** Normalized full address the provider resolved (newer sessions). */
          resolvedLabel?: string
          /** Raw provider response; Nominatim reverse-geocode carries `display_name`. */
          raw?: { display_name?: string } | null
          note?: string
        }[]
      | null
  } | null
  media?: string[]
}
