import type { ScreeningHit } from '@arkyc/types'
import type { ScreeningDriver, ScreeningOptions, ScreeningResult, ScreeningSubject } from '../types'

/** A watchlist entry the mock driver matches by name. */
export interface MockWatchlistEntry extends Omit<ScreeningHit, 'score'> {
  /** Names (case-insensitive) that match this entry. */
  aliases: string[]
}

/** Fictional entries, so development and tests can reach every hit category. */
export const MOCK_WATCHLIST: MockWatchlistEntry[] = [
  {
    entity_id: 'mock-sanction-1',
    name: 'Ivan Sanctionov',
    aliases: ['ivan sanctionov'],
    category: 'sanction',
    topics: ['sanction'],
    datasets: ['mock_sanctions'],
    birth_dates: ['1970-01-01'],
    countries: ['ru'],
  },
  {
    entity_id: 'mock-pep-1',
    name: 'Paula Politico',
    aliases: ['paula politico'],
    category: 'pep',
    topics: ['role.pep'],
    datasets: ['mock_peps'],
    birth_dates: ['1965-05-05'],
    countries: ['gb'],
  },
]

/** Deterministic screening for development and tests: exact name matches against a watchlist. */
export class MockScreeningDriver implements ScreeningDriver {
  readonly name = 'mock'

  constructor(private readonly watchlist: MockWatchlistEntry[] = MOCK_WATCHLIST) {}

  async screen(subject: ScreeningSubject, options: ScreeningOptions): Promise<ScreeningResult> {
    const name = subject.name.trim().toLowerCase()
    const hits = this.watchlist
      .filter((entry) => entry.aliases.includes(name))
      .map(({ aliases: _aliases, ...entry }) => ({ ...entry, score: 0.95 }))
      .filter((hit) => hit.score >= options.threshold)

    return { hits, raw: { provider: 'mock' } }
  }
}
