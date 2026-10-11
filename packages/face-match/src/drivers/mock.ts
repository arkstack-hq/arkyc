import type { FaceMatchResultData } from '@arkyc/types'
import { createHash } from 'node:crypto'
import type { FaceEmbedding, FaceMatchDriver, FaceMatchRequest } from '../types'

const MOCK_EMBEDDING_SIZE = 128

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))

/**
 * Deterministic face-match driver for development + tests. Passes by default;
 * `hints` steer the similarity score and verdict.
 */
export class MockFaceMatchDriver implements FaceMatchDriver {
  readonly name = 'mock'

  async compare(request: FaceMatchRequest): Promise<FaceMatchResultData> {
    const similarityScore = clamp01(request.hints?.similarityScore ?? 0.9)
    const passed = request.hints?.passed ?? similarityScore >= 0.5

    return {
      passed,
      similarityScore,
      confidence: 0.93,
      raw: { provider: 'mock', similarityScore },
    }
  }

  /** A unit vector derived from the image bytes, so identical images embed identically. */
  async embed(image: Uint8Array): Promise<FaceEmbedding | null> {
    if (!image.length) return null

    const values: number[] = []
    for (let block = 0; values.length < MOCK_EMBEDDING_SIZE; block += 1) {
      const digest = createHash('sha256').update(image).update(String(block)).digest()
      for (const byte of digest) values.push(byte / 127.5 - 1)
    }
    const vector = values.slice(0, MOCK_EMBEDDING_SIZE)
    const norm = Math.hypot(...vector) || 1

    return { vector: vector.map((v) => v / norm), model: 'mock-v1', matchThreshold: 0.95 }
  }
}
