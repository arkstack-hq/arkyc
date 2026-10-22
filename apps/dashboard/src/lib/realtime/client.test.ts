import { describe, expect, it, vi } from 'vitest'

const createRealtime = vi.hoisted(() => vi.fn((config: unknown) => ({ config })))
vi.mock('@arkstack/realtime', () => ({ createRealtime }))

import { createRealtimeClient, importSdk } from './client'

const base = { event: 'notification', channelPrefix: 'private-user.' }

describe('createRealtimeClient', () => {
  it('authorizes Pusher channels at the dashboard authorizer with the bearer token', () => {
    createRealtimeClient(
      { ...base, transport: 'pusher', pusher: { key: 'k', cluster: 'eu' } },
      { apiBase: 'https://api.test/api', token: 'tkn' },
    )

    expect(createRealtime).toHaveBeenLastCalledWith(
      expect.objectContaining({
        transport: 'pusher',
        pusher: {
          key: 'k',
          cluster: 'eu',
          authEndpoint: 'https://api.test/api/v1/realtime/auth',
          auth: { headers: { Authorization: 'Bearer tkn' } },
        },
      }),
    )
  })

  it('authorizes Firebase database channels the same way', () => {
    createRealtimeClient(
      {
        ...base,
        transport: 'firebase-database',
        'firebase-database': { apiKey: 'a', projectId: 'p', databaseURL: 'https://p.firebaseio.com' },
      },
      { apiBase: '/api', token: null },
    )

    expect(createRealtime).toHaveBeenLastCalledWith(
      expect.objectContaining({
        'firebase-database': expect.objectContaining({
          authEndpoint: '/api/v1/realtime/auth',
          auth: { headers: { Authorization: 'Bearer ' } },
        }),
      }),
    )
  })

  it('leaves transports without channel auth untouched', () => {
    createRealtimeClient(
      { ...base, transport: 'polling', polling: { interval: 3000 } },
      { apiBase: '/api', token: 't' },
    )

    expect(createRealtime).toHaveBeenLastCalledWith(
      expect.objectContaining({ ...base, transport: 'polling', polling: { interval: 3000 }, importModule: importSdk }),
    )
  })
})

describe('importSdk', () => {
  it('loads bundled transport SDKs and refuses unknown ones', async () => {
    await expect(importSdk('pusher-js')).resolves.toBeTruthy()
    await expect(importSdk('left-pad')).rejects.toThrow(/Unknown realtime SDK/)
  })
})
