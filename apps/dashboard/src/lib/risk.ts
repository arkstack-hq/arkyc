import type { RiskSeverity, RiskSignalKey } from '@arkyc/types'

/** Reviewer-facing names for risk signals. */
export const RISK_SIGNAL_LABEL: Record<RiskSignalKey, string> = {
  duplicate_document: 'Duplicate document',
  duplicate_identity: 'Duplicate identity',
  duplicate_face: 'Duplicate face',
  document_tampering: 'Possible tampering',
  document_inconsistent: 'Inconsistent document',
  sanctions_match: 'Sanctions match',
  pep_match: 'Politically exposed person',
  adverse_media: 'Adverse media',
  high_risk_network: 'High-risk network',
  ip_country_mismatch: 'IP country mismatch',
  velocity_exceeded: 'Too many sessions',
  underage: 'Underage',
}

export const RISK_SEVERITY_VARIANT: Record<RiskSeverity, 'secondary' | 'warning' | 'destructive'> = {
  info: 'secondary',
  review: 'warning',
  reject: 'destructive',
}

/** What each signal means, for the workflow policy editor. */
export const RISK_SIGNAL_DESCRIPTION: Record<RiskSignalKey, string> = {
  duplicate_document: 'The document was already used by another user.',
  duplicate_identity: 'Another user has the same name and date of birth.',
  duplicate_face: 'The selfie matches another user (needs face duplicate detection).',
  document_tampering: 'The AI document reader suspects a screen, photocopy or edit.',
  document_inconsistent: 'MRZ check digits fail or the dates are impossible.',
  sanctions_match: 'The identity is on a sanctions list.',
  pep_match: 'The identity is a politically exposed person.',
  adverse_media: 'The identity appears on crime or warning lists.',
  high_risk_network: 'The user connected through a VPN, Tor, proxy or data centre.',
  ip_country_mismatch: 'The IP country differs from the document nationality.',
  velocity_exceeded: 'Too many sessions came from the same address.',
  underage: 'The holder is younger than the minimum age.',
}
