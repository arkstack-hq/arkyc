import type { LivenessChallenge } from '@arkyc/types'

/** The full pool of active-liveness challenges the server can issue. */
export const LIVENESS_CHALLENGE_POOL: readonly LivenessChallenge[] = [
  'turn_left',
  'turn_right',
  'blink',
  'smile',
  'nod',
  'move_closer',
]

/**
 * Generate a randomized active-liveness challenge sequence of `count` distinct
 * challenges (a partial Fisher–Yates shuffle of the pool). Issued per session so
 * a recorded video can't be replayed against a different challenge order.
 *
 * @param count  How many challenges to issue (clamped to the pool size).
 * @param random Injectable RNG (defaults to `Math.random`); pass a seeded fn in tests.
 */
export function randomChallenges(count = 3, random: () => number = Math.random): LivenessChallenge[] {
  const pool = [...LIVENESS_CHALLENGE_POOL]
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j]!, pool[i]!]
  }
  return pool.slice(0, Math.max(0, Math.min(count, pool.length)))
}

/** Whether the `performed` sequence exactly matches the `issued` one (order matters). */
export function challengesMatch(
  issued: readonly LivenessChallenge[],
  performed: readonly LivenessChallenge[],
): boolean {
  return (
    issued.length > 0 &&
    issued.length === performed.length &&
    issued.every((challenge, index) => challenge === performed[index])
  )
}
