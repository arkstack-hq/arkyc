import { describe, expect, it, vi } from 'vitest'
import { ArkycWidget } from '../src/browser'

function fakeEl() {
  return {
    setAttribute: vi.fn(),
    appendChild: vi.fn(),
    remove: vi.fn(),
    style: {} as Record<string, string>,
    src: '',
    allow: '',
  }
}

function fakeDom() {
  const created: ReturnType<typeof fakeEl>[] = []
  let messageHandler: ((event: { data: unknown }) => void) | undefined
  const body = fakeEl()

  const doc = {
    createElement: vi.fn(() => {
      const el = fakeEl()
      created.push(el)
      return el
    }),
    body,
  } as unknown as Document

  const win = {
    addEventListener: vi.fn((type: string, handler: (event: { data: unknown }) => void) => {
      if (type === 'message') messageHandler = handler
    }),
    removeEventListener: vi.fn(),
  } as unknown as Window

  return { doc, win, created, body, fire: (data: unknown) => messageHandler?.({ data }) }
}

describe('ArkycWidget.open', () => {
  it('mounts an iframe with the client token and resolves on completion', () => {
    const dom = fakeDom()
    const onComplete = vi.fn()

    ArkycWidget.open({
      token: 'ct_xyz',
      widgetUrl: 'https://verify.test',
      onComplete,
      doc: dom.doc,
      win: dom.win,
    })

    const iframe = dom.created.find((el) => el.src.includes('verify.test'))
    expect(iframe?.src).toBe('https://verify.test?token=ct_xyz')
    expect(dom.body.appendChild).toHaveBeenCalled()

    // Ignores unrelated postMessages.
    dom.fire({ type: 'other' })
    expect(onComplete).not.toHaveBeenCalled()

    // Resolves + tears down on the completion message.
    dom.fire({ type: 'arkyc:complete', payload: { status: 'approved' } })
    expect(onComplete).toHaveBeenCalledWith({ status: 'approved' })
    expect(dom.win.removeEventListener).toHaveBeenCalled()
  })

  it('closes via the returned handle', () => {
    const dom = fakeDom()
    const onClose = vi.fn()
    const handle = ArkycWidget.open({ token: 'ct_1', onClose, doc: dom.doc, win: dom.win })

    handle.close()
    expect(onClose).toHaveBeenCalled()
    expect(dom.win.removeEventListener).toHaveBeenCalled()
  })

  it('throws without a token', () => {
    expect(() => ArkycWidget.open({ token: '' })).toThrow(/token/)
  })
})
