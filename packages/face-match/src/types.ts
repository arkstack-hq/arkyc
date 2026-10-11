import type { FaceMatchResultData } from '@arkyc/types'

/** The two images compared by a face-match driver. */
export interface FaceMatchRequest {
  /** Portrait extracted from the identity document. */
  documentPortrait: Uint8Array
  /** Selfie captured during liveness. */
  selfie: Uint8Array
  /**
   * Optional deterministic signals (used by the `mock` driver and tests to
   * steer the similarity / verdict). Ignored by real drivers.
   */
  hints?: { similarityScore?: number; passed?: boolean }
}

/** A face embedding: a vector two images of the same person land close together in. */
export interface FaceEmbedding {
  vector: number[]
  /** The model that produced it. Embeddings from different models are not comparable. */
  model: string
  /** Cosine similarity at or above which two embeddings are the same person. */
  matchThreshold: number
}

/** A pluggable face-match provider. */
export interface FaceMatchDriver {
  readonly name: string
  compare(request: FaceMatchRequest): Promise<FaceMatchResultData>
  /** Embed the most prominent face in an image, or `null` when there is none. Optional capability. */
  embed?(image: Uint8Array): Promise<FaceEmbedding | null>
}

/** Identifier for a registered face-match driver. */
export type FaceMatchDriverName = 'mock' | 'external' | 'local'

/** Configuration selecting + parameterising the active face-match driver. */
export interface FaceMatchConfig {
  driver: FaceMatchDriverName
  endpoint?: string
  apiKey?: string
  /** Where the `local` driver finds its model files. */
  modelDirectory?: string
}
