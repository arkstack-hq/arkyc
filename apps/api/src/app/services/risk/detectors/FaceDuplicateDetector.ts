import { DEFAULT_FACE_EMBEDDING_SETTINGS, type RiskSignal } from '@arkyc/types'
import { Organization } from '@app/models/Organization'
import { faceMatchDriver } from '@app/services/providers'
import { faceEmbeddings } from '../FaceEmbeddingStore'
import type { RiskContext, RiskDetector } from '../types'

/**
 * The same face behind another user reference in the organization. Runs only
 * for organizations that opt in to storing face embeddings, and only with a
 * face-match driver that can embed.
 */
export class FaceDuplicateDetector implements RiskDetector {
  readonly source = 'face'

  async detect({ session, selfie }: RiskContext): Promise<RiskSignal[]> {
    if (!selfie?.length || !faceMatchDriver.embed) return []

    const organization = await Organization.where({ id: session.organizationId }).first()
    const settings = { ...DEFAULT_FACE_EMBEDDING_SETTINGS, ...(organization?.settings?.face_embeddings ?? {}) }

    if (!settings.enabled) return []

    const embedding = await faceMatchDriver.embed(selfie)

    if (!embedding) return []

    const neighbours = session.userReference
      ? (await faceEmbeddings.similar(session, embedding)).filter(
          (row) => row.user_reference !== null && row.user_reference !== session.userReference,
        )
      : []

    await faceEmbeddings.store(session, embedding, settings.retention_days)

    if (!neighbours.length) return []

    return [
      {
        key: 'duplicate_face',
        severity: 'review',
        score: 0.6,
        evidence: {
          model: embedding.model,
          matches: neighbours.map((row) => ({ session_id: row.session_id, similarity: row.similarity })),
        },
      },
    ]
  }
}
