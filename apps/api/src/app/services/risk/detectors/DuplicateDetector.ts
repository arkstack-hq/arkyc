import type { RiskSignal } from '@arkyc/types'
import { SessionFingerprint, type FingerprintKind } from '@app/models/SessionFingerprint'
import { toArray } from 'src/support/collection'
import { Fingerprints } from '../Fingerprints'
import { extractedName, type RiskContext, type RiskDetector } from '../types'

const MATCH_LIMIT = 5

/**
 * A document or identity already seen in the organization under a different
 * user reference. Sessions without a user reference are fingerprinted but never
 * matched, since there is no other user to compare against.
 */
export class DuplicateDetector implements RiskDetector {
  readonly source = 'fingerprint'

  async detect({ session, ocr, capture }: RiskContext): Promise<RiskSignal[]> {
    if (!ocr) return []

    const hashes: Array<[FingerprintKind, string | null]> = [
      ['document', Fingerprints.document(ocr.fields, capture?.country ?? null, capture?.documentType ?? null)],
      ['identity', Fingerprints.identity(extractedName(ocr.fields), ocr.fields.dateOfBirth)],
    ]

    const signals: RiskSignal[] = []
    for (const [kind, hash] of hashes) {
      if (!hash) continue

      const matches = session.userReference ? await this.matches(session, kind, hash) : []
      if (matches.length) {
        signals.push({
          key: kind === 'document' ? 'duplicate_document' : 'duplicate_identity',
          severity: 'review',
          score: kind === 'document' ? 0.6 : 0.3,
          evidence: { matched_session_ids: matches },
        })
      }

      await this.remember(session, kind, hash)
    }

    return signals
  }

  private async matches(session: RiskContext['session'], kind: FingerprintKind, hash: string): Promise<string[]> {
    const rows = await SessionFingerprint.query()
      .where({ organizationId: session.organizationId, kind, hash })
      .where('sessionId', '!=', session.id)
      .whereNotNull('userReference')
      .where('userReference', '!=', session.userReference!)
      .latest('createdAt')
      .limit(MATCH_LIMIT)
      .get()

    return toArray(rows).map((row) => row.sessionId)
  }

  private async remember(session: RiskContext['session'], kind: FingerprintKind, hash: string): Promise<void> {
    await SessionFingerprint.query().updateOrCreate(
      { sessionId: session.id, kind },
      {
        organizationId: session.organizationId,
        projectId: session.projectId,
        hash,
        userReference: session.userReference,
      },
    )
  }
}
