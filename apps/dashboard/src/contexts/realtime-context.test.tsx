import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRealtime, emitMemoryEvent, type RealtimeClient } from '@arkstack/realtime'
import { REALTIME_EVENT } from '@arkyc/types'
import { RealtimeContext, useRealtimeChannel, type RealtimeHandler } from './realtime-context'

function Listener({ channel, handler, events }: { channel: string; handler: RealtimeHandler; events?: string[] }) {
  useRealtimeChannel(channel, handler, events)

  return null
}

const mount = (client: RealtimeClient, props: Parameters<typeof Listener>[0]) =>
  render(
    <RealtimeContext.Provider value={{ client }}>
      <Listener {...props} />
    </RealtimeContext.Provider>,
  )

/** Let the async subscriptions settle. */
const settle = () => act(async () => await new Promise((resolve) => setTimeout(resolve, 0)))

afterEach(() => {
  vi.useRealTimers()
})

describe('useRealtimeChannel', () => {
  it('runs the handler for domain events on the channel only', async () => {
    const handler = vi.fn()
    mount(createRealtime({ transport: 'memory' }), { channel: 'private-session.s1', handler })
    await settle()

    emitMemoryEvent('private-session.s1', REALTIME_EVENT.sessionTransition, { status: 'approved' })
    emitMemoryEvent('private-session.s1', 'unrelated', {})
    emitMemoryEvent('private-session.s2', REALTIME_EVENT.reviewAction, {})

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith(REALTIME_EVENT.sessionTransition, { status: 'approved' })
  })

  it('listens for the events it is given', async () => {
    const handler = vi.fn()
    mount(createRealtime({ transport: 'memory' }), { channel: 'private-user.u1', handler, events: ['notification'] })
    await settle()

    emitMemoryEvent('private-user.u1', 'notification', { id: 'n1' })
    emitMemoryEvent('private-user.u1', REALTIME_EVENT.reviewAction, {})

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith('notification', { id: 'n1' })
  })

  it('stops listening when unmounted', async () => {
    const handler = vi.fn()
    const view = mount(createRealtime({ transport: 'memory' }), { channel: 'private-user.u2', handler })
    await settle()

    view.unmount()
    emitMemoryEvent('private-user.u2', REALTIME_EVENT.sessionTransition, {})

    expect(handler).not.toHaveBeenCalled()
  })

  it('polls on the advertised interval under the polling transport', async () => {
    vi.useFakeTimers()
    const handler = vi.fn()
    const view = mount(createRealtime({ transport: 'polling', polling: { interval: 1000 } }), {
      channel: 'private-session.s3',
      handler,
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    expect(handler).toHaveBeenCalledTimes(3)
    expect(handler).toHaveBeenCalledWith('poll', undefined)

    view.unmount()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    expect(handler).toHaveBeenCalledTimes(3)
  })
})
