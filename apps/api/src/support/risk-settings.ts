import { ValidationException } from 'kanun'
import {
  DEFAULT_FACE_EMBEDDING_SETTINGS,
  DEFAULT_VELOCITY_SETTINGS,
  type FaceEmbeddingSettings,
  type VelocitySettings,
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
