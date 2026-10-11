import type { ScreeningConfig, ScreeningDriver, ScreeningOptions, ScreeningResult, ScreeningSubject } from '../types'

/**
 * Generic HTTP screening driver: POSTs `{ subject, threshold }` to a configured
 * endpoint and expects a {@link ScreeningResult}-shaped JSON response.
 */
export class ExternalScreeningDriver implements ScreeningDriver {
  readonly name = 'external'

  constructor(private readonly config: ScreeningConfig) {
    if (!config.endpoint) throw new Error('ExternalScreeningDriver requires config.endpoint')
  }

  async screen(subject: ScreeningSubject, options: ScreeningOptions): Promise<ScreeningResult> {
    const res = await fetch(this.config.endpoint as string, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.config.apiKey ? { authorization: `Bearer ${this.config.apiKey}` } : {}),
      },
      body: JSON.stringify({ subject, threshold: options.threshold }),
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 15_000),
    })

    if (!res.ok) {
      throw new Error(`ExternalScreeningDriver request failed with status ${res.status}`)
    }

    const result = (await res.json()) as ScreeningResult

    return { hits: result.hits.filter((hit) => hit.score >= options.threshold), raw: result.raw }
  }
}
