import { ValidationException } from 'kanun'
import {
  DEFAULT_FACE_EMBEDDING_SETTINGS,
  DEFAULT_VELOCITY_SETTINGS,
  DEFAULT_VERIFICATION_THRESHOLDS,
  type FaceEmbeddingSettings,
  type VelocitySettings,
  type VerificationThresholds,
} from '@arkyc/types'

/** A whole number in [min, max], or `fallback` when absent. */
function wholeNumber(raw: unknown, fallback: number, min: number, max: number, message: string): number {
  if (raw == null || raw === '') return fallback

  const value = Number(raw)
  if (!Number.isInteger(value) || value < min || value > max) {
    throw ValidationException.withMessages({ settings: [message] })
  }

  return value
}

/**
 * Validate a project's `velocity` settings.
 *
 * @param raw
 * @returns
 */
export function normalizeVelocitySettings(raw: unknown): VelocitySettings {
  const input = (raw ?? {}) as Partial<Record<keyof VelocitySettings, unknown>>

  return {
    max_sessions: wholeNumber(
      input.max_sessions,
      DEFAULT_VELOCITY_SETTINGS.max_sessions,
      1,
      10_000,
      'Velocity max sessions must be a whole number from 1 to 10000.',
    ),
    window_minutes: wholeNumber(
      input.window_minutes,
      DEFAULT_VELOCITY_SETTINGS.window_minutes,
      1,
      43_200,
      'Velocity window must be from 1 minute to 30 days.',
    ),
  }
}

/**
 * Validate an organization's `face_embeddings` settings.
 *
 * @param raw
 * @returns
 */
export function normalizeFaceEmbeddingSettings(raw: unknown): FaceEmbeddingSettings {
  const input = (raw ?? {}) as Partial<Record<keyof FaceEmbeddingSettings, unknown>>

  return {
    enabled: input.enabled === true,
    retention_days: wholeNumber(
      input.retention_days,
      DEFAULT_FACE_EMBEDDING_SETTINGS.retention_days,
      1,
      3650,
      'Face embedding retention must be from 1 to 3650 days.',
    ),
  }
}

/**
 * The verification thresholds a project can override, each a score in [0, 1].
 */
const THRESHOLD_KEYS: (keyof VerificationThresholds)[] = [
  'documentQualityThreshold',
  'ocrConfidenceThreshold',
  'livenessThreshold',
  'faceMatchThreshold',
  'faceMatchRejectThreshold',
  'addressThreshold',
]

/**
 * Merge a project's threshold overrides into its current ones. Each value must be
 * a number from 0 to 1; `null` (or blank) clears the override, falling back to the
 * default (for `faceMatchRejectThreshold`: off). Unknown keys are dropped. The
 * face-match reject floor may not sit above the face-match threshold, or matches
 * meant for review would be rejected.
 *
 * @param current  The project's stored overrides.
 * @param raw      The requested changes.
 * @returns        The merged overrides to store.
 */
export function mergeThresholds(
  current: Partial<VerificationThresholds> | undefined,
  raw: unknown,
): Partial<VerificationThresholds> {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const merged: Partial<VerificationThresholds> = { ...(current ?? {}) }

  for (const key of THRESHOLD_KEYS) {
    if (!(key in input)) continue
    const value = input[key]

    if (value == null || value === '') {
      delete merged[key]
      continue
    }

    const score = Number(value)
    if (!Number.isFinite(score) || score < 0 || score > 1) {
      throw ValidationException.withMessages({ thresholds: [`${key} must be a number from 0 to 1.`] })
    }
    merged[key] = score
  }

  const floor = merged.faceMatchRejectThreshold
  const faceMatch = merged.faceMatchThreshold ?? DEFAULT_VERIFICATION_THRESHOLDS.faceMatchThreshold
  if (typeof floor === 'number' && floor > faceMatch) {
    throw ValidationException.withMessages({
      thresholds: [`faceMatchRejectThreshold (${floor}) must not be above faceMatchThreshold (${faceMatch}).`],
    })
  }

  return merged
}
