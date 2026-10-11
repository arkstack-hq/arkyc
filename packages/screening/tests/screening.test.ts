import { afterEach, describe, expect, it, vi } from 'vitest'
import { ScreeningDriverFactory, categorize } from '../src/index'

afterEach(() => vi.unstubAllGlobals())

describe('categorize', () => {
  it('ranks sanctions over PEP over adverse media', () => {
    expect(categorize(['role.pep', 'sanction'])).toBe('sanction')
    expect(categorize(['role.rca'])).toBe('pep')
    expect(categorize(['crime.fin'])).toBe('adverse_media')
    expect(categorize([])).toBe('other')
  })
})

describe('MockScreeningDriver', () => {
  const driver = ScreeningDriverFactory.create({ driver: 'mock' })

  it('hits on a watchlist name and passes everyone else', async () => {
    const hit = await driver.screen({ name: 'Ivan Sanctionov' }, { threshold: 0.7 })
    expect(hit.hits).toMatchObject([{ entity_id: 'mock-sanction-1', category: 'sanction' }])

    expect((await driver.screen({ name: 'Ada Lovelace' }, { threshold: 0.7 })).hits).toEqual([])
  })
})

describe('OpenSanctionsScreeningDriver', () => {
  it('requires a key for the hosted API but not for yente', () => {
    expect(() => ScreeningDriverFactory.create({ driver: 'opensanctions' })).toThrow(/API key/)
    expect(() =>
      ScreeningDriverFactory.create({ driver: 'opensanctions', endpoint: 'http://yente:8000' }),
    ).not.toThrow()
  })

  it('maps match results above the threshold into hits', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          responses: {
            subject: {
              results: [
                {
                  id: 'Q1',
                  caption: 'Some Person',
                  score: 0.91,
                  datasets: ['us_ofac_sdn'],
                  properties: { topics: ['sanction'], birthDate: ['1950-01-01'], country: ['ru'] },
                },
                { id: 'Q2', caption: 'Weak Match', score: 0.4 },
              ],
            },
          },
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const driver = ScreeningDriverFactory.create({ driver: 'opensanctions', apiKey: 'key' })
    const result = await driver.screen({ name: 'Some Person', birthDate: '1950-01-01' }, { threshold: 0.7 })

    expect(result.hits).toEqual([
      expect.objectContaining({ entity_id: 'Q1', category: 'sanction', datasets: ['us_ofac_sdn'], countries: ['ru'] }),
    ])
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://api.opensanctions.org/match/default?threshold=0.7')
    expect(init.headers.authorization).toBe('ApiKey key')
    expect(JSON.parse(init.body).queries.subject.properties).toEqual({
      name: ['Some Person'],
      birthDate: ['1950-01-01'],
    })
  })
})
