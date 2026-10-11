import type { ScreeningHit } from '@arkyc/types'
import type { ScreeningConfig, ScreeningDriver, ScreeningOptions, ScreeningResult, ScreeningSubject } from '../types'
import { categorize } from '../topics'

const HOSTED_ENDPOINT = 'https://api.opensanctions.org'
const DEFAULT_DATASET = 'default'
const DEFAULT_TIMEOUT_MS = 15_000

interface MatchEntity {
  id: string
  caption: string
  score: number
  datasets?: string[]
  properties?: Record<string, string[] | undefined>
}

interface MatchResponse {
  responses?: Record<string, { results?: MatchEntity[] }>
}

/**
 * Screens against OpenSanctions through its `/match` API, either the hosted
 * service or a self-hosted yente instance (which serves the same API).
 */
export class OpenSanctionsScreeningDriver implements ScreeningDriver {
  readonly name = 'opensanctions'

  private readonly endpoint: string
  private readonly dataset: string

  constructor(private readonly config: ScreeningConfig) {
    this.endpoint = (config.endpoint || HOSTED_ENDPOINT).replace(/\/$/, '')
    this.dataset = config.dataset || DEFAULT_DATASET
    if (this.endpoint === HOSTED_ENDPOINT && !config.apiKey) {
      throw new Error('OpenSanctionsScreeningDriver requires an API key for the hosted API')
    }
  }

  async screen(subject: ScreeningSubject, options: ScreeningOptions): Promise<ScreeningResult> {
    const properties: Record<string, string[]> = { name: [subject.name] }
    if (subject.birthDate) properties.birthDate = [subject.birthDate]
    if (subject.nationality) properties.nationality = [subject.nationality]
    if (subject.documentNumber) properties.idNumber = [subject.documentNumber]

    const url = `${this.endpoint}/match/${encodeURIComponent(this.dataset)}?threshold=${options.threshold}`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.config.apiKey ? { authorization: `ApiKey ${this.config.apiKey}` } : {}),
      },
      body: JSON.stringify({ queries: { subject: { schema: 'Person', properties } } }),
      signal: AbortSignal.timeout(this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    })

    if (!res.ok) {
      throw new Error(`OpenSanctions match failed with status ${res.status}`)
    }

    const body = (await res.json()) as MatchResponse
    const results = body.responses?.subject?.results ?? []
    const hits = results
      .filter((entity) => entity.score >= options.threshold)
      .map((entity) => this.hit(entity))
      .sort((a, b) => b.score - a.score)

    return { hits, raw: { provider: 'opensanctions', dataset: this.dataset, candidates: results.length } }
  }

  private hit(entity: MatchEntity): ScreeningHit {
    const topics = entity.properties?.topics ?? []

    return {
      entity_id: entity.id,
      name: entity.caption,
      score: entity.score,
      category: categorize(topics),
      topics,
      datasets: entity.datasets ?? [],
      birth_dates: entity.properties?.birthDate ?? [],
      countries: entity.properties?.country ?? entity.properties?.nationality ?? [],
      url: `https://www.opensanctions.org/entities/${encodeURIComponent(entity.id)}/`,
    }
  }
}
