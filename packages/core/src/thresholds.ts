import type { VerificationThresholds } from '@arkyc/types';

/**
 * Platform default verification thresholds. Projects may override any subset
 * via `ProjectSettings.thresholds`; {@link resolveThresholds} merges them.
 */
export const DEFAULT_THRESHOLDS: VerificationThresholds = {
  documentQualityThreshold: 0.75,
  ocrConfidenceThreshold: 0.8,
  livenessThreshold: 0.85,
  faceMatchThreshold: 0.75,
};

/** Merge a partial set of project overrides over the platform defaults. */
export function resolveThresholds(
  overrides?: Partial<VerificationThresholds>,
): VerificationThresholds {
  return { ...DEFAULT_THRESHOLDS, ...(overrides ?? {}) };
}
