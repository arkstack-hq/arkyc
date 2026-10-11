import { afterEach, describe, expect, it, vi } from 'vitest'
import { REALTIME_EVENT } from '@arkyc/types'

const fake = vi.hoisted(() => ({
  configs: [] as Array<Record<string, unknown>>,
  listeners: new Map<string, (data: unknown) => void>(),
  stopped: [] as string[],
  connectError: null as Error | null,
  disconnected: 0,
}))

vi.mock('@arkstack/realtime', () => ({
  createRealtime: (config: Record<string, unknown>) => {
    fake.configs.push(config)

    return {
      onPoll: async () => {
        if (fake.connectError) throw fake.connectError

        return () => {}
      },
      listen: async (channel: string, event: string, handler: (data: unknown) => void) => {
        fake.listeners.set(`${channel}:${event}`, handler)

        return () => fake.stopped.push(`${channel}:${event}`)
      },
      disconnect: async () => {
        fake.disconnected++
      },
    }
  },
}))

import { createWidgetRealtimeClient, importWithCdnFallback } from '../src/realtime'

const options = { authEndpoint: 'https://api.test/api/v1/client/realtime/auth', token: 'client-token' }

/** Let the async subscriptions settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

afterEach(() => {
  fake.configs.length = 0
  fake.listeners.clear()
  fake.stopped.length = 0
  fake.connectError = null
  fake.disconnected = 0
})

describe('createWidgetRealtimeClient', () => {
  it('authorizes Pusher channels with the client token and loads SDKs with the CDN fallback', async () => {
    await createWidgetRealtimeClient(
      { transport: 'pusher', channel: 'private-session.s1', pusher: { key: 'k', cluster: 'eu' } },
      options,
    )

    expect(fake.configs[0]).toEqual({
      transport: 'pusher',
      pusher: {
        key: 'k',
        cluster: 'eu',
        authEndpoint: options.authEndpoint,
        auth: { headers: { 'X-Client-Token': 'client-token' } },
      },
      'firebase-database': undefined,
      importModule: importWithCdnFallback,
    })
  })

  it('authorizes Firebase database channels the same way', async () => {
    await createWidgetRealtimeClient(
      {
        transport: 'firebase-database',
        channel: 'private-session.s1',
        'firebase-database': { apiKey: 'a', projectId: 'p', databaseURL: 'https://p.firebaseio.com' },
      },
      options,
    )

    expect(fake.configs[0]?.['firebase-database']).toMatchObject({
      authEndpoint: options.authEndpoint,
      auth: { headers: { 'X-Client-Token': 'client-token' } },
    })
  })

  it('polls instead of streaming over polling or Firebase Cloud Messaging', async () => {
    await expect(createWidgetRealtimeClient({ transport: 'polling', channel: 'c' }, options)).resolves.toBeNull()
    await expect(createWidgetRealtimeClient({ transport: 'firebase', channel: 'c' }, options)).resolves.toBeNull()
    expect(fake.configs).toHaveLength(0)
  })

  it('rejects when the transport cannot connect, so the widget polls', async () => {
    fake.connectError = new Error('pusher-js missing')

    await expect(
      createWidgetRealtimeClient({ transport: 'pusher', channel: 'c', pusher: { key: 'k' } }, options),
    ).rejects.toThrow(/pusher-js/)
  })

  it('hands session transitions to the subscriber and stops on unsubscribe', async () => {
    const client = await createWidgetRealtimeClient(
      { transport: 'pusher', channel: 'private-session.s1', pusher: { key: 'k' } },
      options,
    )
    const handler = vi.fn()

    const unsubscribe = client!.subscribe('private-session.s1', handler)
    await settle()
    fake.listeners.get(`private-session.s1:${REALTIME_EVENT.sessionTransition}`)!({ status: 'approved' })
    unsubscribe()

    expect(handler).toHaveBeenCalledWith(REALTIME_EVENT.sessionTransition, { status: 'approved' })
    expect(fake.stopped).toEqual([`private-session.s1:${REALTIME_EVENT.sessionTransition}`])
  })

  it('drops a subscription that resolves after unsubscribing', async () => {
    const client = await createWidgetRealtimeClient(
      { transport: 'pusher', channel: 'private-session.s1', pusher: { key: 'k' } },
      options,
    )

    client!.subscribe('private-session.s1', vi.fn())()
    await settle()

    expect(fake.stopped).toEqual([`private-session.s1:${REALTIME_EVENT.sessionTransition}`])
  })

  it('disconnects the underlying client', async () => {
    const client = await createWidgetRealtimeClient(
      { transport: 'pusher', channel: 'private-session.s1', pusher: { key: 'k' } },
      options,
    )

    client!.disconnect()

    expect(fake.disconnected).toBe(1)
  })
})

describe('importWithCdnFallback', () => {
  it('rethrows for modules it has no CDN path for', async () => {
    await expect(importWithCdnFallback('definitely-not-installed-sdk')).rejects.toThrow()
  })
})
