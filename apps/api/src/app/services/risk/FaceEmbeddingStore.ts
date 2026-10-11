import { DB } from 'arkormx'
import type { FaceEmbedding } from '@arkyc/face-match'
import type { VerificationSession } from '@app/models/VerificationSession'

const DAY_MS = 86_400_000
const SEARCH_LIMIT = 5
const PURGE_BATCH = 1000

/** A stored embedding close to a probe. */
export interface FaceNeighbour {
  session_id: string
  user_reference: string | null
  similarity: number
}

/** Face embeddings in pgvector, scoped per organization and model. */
export class FaceEmbeddingStore {
  /**
   * The nearest embeddings from other sessions in the organization at or above
   * the model's match threshold.
   *
   * @param session
   * @param embedding
   * @returns
   */
  async similar(session: VerificationSession, embedding: FaceEmbedding): Promise<FaceNeighbour[]> {
    const rows = await DB.raw<{ session_id: string; user_reference: string | null; similarity: number }>(
      `select session_id, user_reference, 1 - (embedding <=> ?::vector) as similarity
         from face_embeddings
        where organization_id = ? and model = ? and session_id <> ? and expires_at > now()
        order by embedding <=> ?::vector
        limit ${SEARCH_LIMIT}`,
      [
        this.literal(embedding.vector),
        session.organizationId,
        embedding.model,
        session.id,
        this.literal(embedding.vector),
      ],
    )

    return rows
      .all()
      .map((row) => ({ ...row, similarity: Number(row.similarity) }))
      .filter((row) => row.similarity >= embedding.matchThreshold)
  }

  /**
   * Store (or replace) the session's embedding until `retentionDays` from now.
   *
   * @param session
   * @param embedding
   * @param retentionDays
   */
  async store(session: VerificationSession, embedding: FaceEmbedding, retentionDays: number): Promise<void> {
    await DB.raw(
      `insert into face_embeddings
         (organization_id, project_id, session_id, user_reference, model, embedding, expires_at)
       values (?, ?, ?, ?, ?, ?::vector, ?)
       on conflict (session_id) do update
         set model = excluded.model, embedding = excluded.embedding,
             expires_at = excluded.expires_at, updated_at = now()`,
      [
        session.organizationId,
        session.projectId,
        session.id,
        session.userReference,
        embedding.model,
        this.literal(embedding.vector),
        new Date(Date.now() + retentionDays * DAY_MS).toISOString(),
      ],
    )
  }

  /**
   * Delete one bounded batch of embeddings past their retention.
   *
   * @returns The number deleted.
   */
  async purgeExpired(): Promise<number> {
    const rows = await DB.raw<{ id: string }>(
      `delete from face_embeddings
        where id in (select id from face_embeddings where expires_at <= now() limit ${PURGE_BATCH})
        returning id`,
    )

    return rows.all().length
  }

  private literal(vector: number[]): string {
    return `[${vector.join(',')}]`
  }
}

/** Shared singleton. */
export const faceEmbeddings = new FaceEmbeddingStore()
