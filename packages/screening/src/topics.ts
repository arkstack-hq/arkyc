import type { ScreeningHitCategory } from '@arkyc/types'

/**
 * The most severe category a set of FollowTheMoney topics describes: sanctions
 * first, then politically exposed persons, then adverse media.
 *
 * @param topics
 * @returns
 */
export function categorize(topics: string[]): ScreeningHitCategory {
  if (topics.some((topic) => topic === 'sanction' || topic.startsWith('sanction.'))) return 'sanction'
  if (topics.some((topic) => topic.startsWith('role.'))) return 'pep'
  if (
    topics.some(
      (topic) =>
        topic.startsWith('crime') ||
        topic.startsWith('reg.') ||
        topic === 'wanted' ||
        topic === 'debarment' ||
        topic === 'poi',
    )
  ) {
    return 'adverse_media'
  }

  return 'other'
}
