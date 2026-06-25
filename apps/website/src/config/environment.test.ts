import { describe, expect, it } from 'vitest'

import { validateAppEnvironment } from './environment'

describe('validateAppEnvironment', () => {
  it('selects the URL for the configured API environment', () => {
    expect(
      validateAppEnvironment({
        VITE_API_ENV: 'staging',
        VITE_APP_ENV: 'testing',
        VITE_STAGING_API_URL: 'https://api.staging.example.com',
      }),
    ).toMatchObject({
      apiEnvironment: 'staging',
      apiUrl: 'https://api.staging.example.com',
      appEnvironment: 'testing',
    })
  })

  it('fails fast when required configuration is missing', () => {
    expect(() => validateAppEnvironment({})).toThrow('Missing required environment variable: VITE_API_ENV')
  })
})
