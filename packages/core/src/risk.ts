import type { DecisionInput } from './decision';

/** Clamp a number into the [0, 1] range. */
export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Average of a list of numbers; 0 for an empty list. */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Compute an aggregate risk score in [0, 1] for a session (higher = riskier).
 *
 * The baseline is the inverse of the mean of the positive signals (document
 * quality, OCR confidence, liveness score, face-match similarity). Hard failure
 * signals (expired document, failed liveness/face-match, multiple faces) floor
 * the risk near the top of the range so risky sessions never look safe.
 */
export function computeRiskScore(input: DecisionInput): number {
  const positives = [
    input.document.qualityScore,
    input.document.ocrConfidence,
    input.liveness.score,
    input.faceMatch.similarityScore,
  ].map(clamp01);

  let risk = 1 - mean(positives);

  const hardFailure =
    input.document.expired ||
    !input.liveness.passed ||
    !input.faceMatch.passed ||
    input.liveness.multipleFaces === true;

  if (hardFailure) {
    risk = Math.max(risk, 0.9);
  }

  return clamp01(risk);
}
