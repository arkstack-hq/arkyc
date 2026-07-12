import { describe, expect, it, vi } from 'vitest'

import { ArkycWidget } from '../src/index'
import { WidgetController, composeHandoffUrl } from '../src/controller'
import type { WidgetEvent } from '../src/types'

// --- Minimal fake DOM (the widget core is DOM-injectable, so no jsdom needed) ---

class FakeEl {
  tagName: string
  children: FakeEl[] = []
  listeners: Record<string, Array<() => void>> = {}
  attributes: Record<string, string> = {}
  style: Record<string, string> = {}
  className = ''
  textContent = ''
  innerHTML = ''
  value = ''
  src = ''
  parent: FakeEl | null = null

  constructor(tag: string) {
    this.tagName = tag
  }

  appendChild(child: FakeEl): FakeEl {
    child.parent = this
    this.children.push(child)
    return child
  }

  removeChild(child: FakeEl): void {
    this.children = this.children.filter((c) => c !== child)
  }

  remove(): void {
    this.parent?.removeChild(this)
  }

  get firstChild(): FakeEl | null {
    return this.children[0] ?? null
  }

  setAttribute(key: string, value: string): void {
    this.attributes[key] = value
  }

  addEventListener(type: string, fn: () => void): void {
    ;(this.listeners[type] ??= []).push(fn)
  }

  click(): void {
    ;(this.listeners.click ?? []).forEach((fn) => fn())
  }

  get classList() {
    return {
      add: (cls: string) => {
        if (!this.className.split(' ').includes(cls)) this.className += (this.className ? ' ' : '') + cls
      },
      remove: (cls: string) => {
        this.className = this.className
          .split(' ')
          .filter((c) => c && c !== cls)
          .join(' ')
      },
      contains: (cls: string) => this.className.split(' ').includes(cls),
    }
  }

  querySelector(): FakeEl | null {
    return null
  }
}

function makeDoc() {
  const body = new FakeEl('body')
  const doc = {
    body,
    createElement: (tag: string) => new FakeEl(tag),
    querySelector: (_sel: string) => null,
  } as unknown as Document
  return { doc, body }
}

/** Recursively find the first element whose trimmed text equals `text`. */
function find(root: FakeEl, text: string): FakeEl | undefined {
  if (root.textContent.trim() === text) return root
  for (const child of root.children) {
    const hit = find(child, text)
    if (hit) return hit
  }
  return undefined
}

function clickText(root: FakeEl, text: string): void {
  const el = find(root, text)
  if (!el) throw new Error(`No element with text "${text}"`)
  el.click()
}

/** Recursively find the first element with an attribute equal to `value`. */
function findByAttr(root: FakeEl, attr: string, value: string): FakeEl | undefined {
  if (root.attributes[attr] === value) return root
  for (const child of root.children) {
    const hit = findByAttr(child, attr, value)
    if (hit) return hit
  }
  return undefined
}

/** Recursively find the first element whose className includes `cls`. */
function findByClass(root: FakeEl, cls: string): FakeEl | undefined {
  if (root.className.split(' ').includes(cls)) return root
  for (const child of root.children) {
    const hit = findByClass(child, cls)
    if (hit) return hit
  }
  return undefined
}

const flush = () => new Promise((r) => setTimeout(r, 0))

function makeFetch(script: { onCall?: (key: string, n: number) => string | undefined } = {}) {
  const counts: Record<string, number> = {}
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const path = String(url).replace(/^https?:\/\/[^/]+/, '')
    const key = `${method} ${path}`
    counts[key] = (counts[key] ?? 0) + 1

    const override = script.onCall?.(key, counts[key])
    const status =
      override ??
      (path.endsWith('/session')
        ? counts[key] === 1
          ? 'started'
          : 'approved'
        : path.endsWith('/document/front')
          ? 'document_submitted'
          : path.endsWith('/liveness')
            ? 'liveness_submitted'
            : path.endsWith('/complete')
              ? 'processing'
              : 'started')

    const ok = status !== 'ERROR'
    return {
      ok,
      status: ok ? 200 : 401,
      text: async () =>
        JSON.stringify({
          status: ok ? 'success' : 'error',
          message: ok ? 'OK' : 'Session expired',
          code: ok ? 200 : 401,
          error: ok ? undefined : 'session_expired',
          data: ok ? { id: 's1', status, expires_at: '2099-01-01' } : null,
        }),
    } as Response
  })
  return { fetchMock, counts }
}

function makeController(over: Partial<ConstructorParameters<typeof WidgetController>[0]> = {}) {
  const { doc, body } = makeDoc()
  const messages: Array<Record<string, unknown>> = []
  const win = {
    parent: { postMessage: (m: Record<string, unknown>) => messages.push(m) },
    location: { search: '' },
  } as unknown as Window
  const nav = {} as Navigator // no mediaDevices → camera unsupported → Upload/Skip path

  const { fetchMock } = makeFetch()
  const controller = new WidgetController({
    token: 'ct',
    doc,
    win,
    nav,
    fetch: fetchMock as never,
    signals: { quality_score: 0.95 },
    scheduler: (fn) => fn(),
    transientMs: 0,
    pollMs: 0,
    maxPolls: 5,
    postToParent: true,
    ...over,
  })
  body.appendChild(controller.element as never)
  return { controller, body, messages, fetchMock, win }
}

describe('WidgetController flow', () => {
  it('walks a passport verification to an approved result and posts arkyc:complete', async () => {
    const onComplete = vi.fn()
    const { controller, messages, fetchMock } = makeController({ onComplete })

    controller.start()
    await flush() // connect → welcome
    clickText(controller.element as unknown as FakeEl, 'Get started')
    await flush()
    clickText(controller.element as unknown as FakeEl, 'Passport')
    await flush()
    clickText(controller.element as unknown as FakeEl, 'Continue') // front instruction
    await flush()
    clickText(controller.element as unknown as FakeEl, 'Skip (demo)') // front capture
    await flush()
    clickText(controller.element as unknown as FakeEl, 'Continue') // selfie instruction
    await flush()
    clickText(controller.element as unknown as FakeEl, 'Skip (demo)') // selfie capture
    await flush()

    // Lands on the result screen.
    expect(find(controller.element as unknown as FakeEl, 'Verified')).toBeTruthy()

    // No back-capture call for a passport.
    const calls = fetchMock.mock.calls.map((c) => `${(c[1] as RequestInit).method} ${String(c[0])}`)
    expect(calls.some((c) => c.includes('/document/back'))).toBe(false)
    expect(calls.some((c) => c.includes('/document/front'))).toBe(true)
    expect(calls.some((c) => c.includes('/liveness'))).toBe(true)
    expect(calls.some((c) => c.includes('/complete'))).toBe(true)

    // Completion is delivered when the user acknowledges the result.
    expect(onComplete).not.toHaveBeenCalled()
    clickText(controller.element as unknown as FakeEl, 'Done')
    expect(onComplete).toHaveBeenCalledWith({ status: 'approved', decision: 'approved' })
    expect(messages).toContainEqual({
      type: 'arkyc:complete',
      payload: { status: 'approved', decision: 'approved' },
    })
  })

  it('runs the active-liveness flow and submits the performed challenge sequence', async () => {
    const challenges = ['blink', 'smile', 'nod']
    const counts: Record<string, number> = {}
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      const path = String(url).replace(/^https?:\/\/[^/]+/, '')
      const key = `${method} ${path}`
      counts[key] = (counts[key] ?? 0) + 1
      const status = path.endsWith('/session')
        ? counts[key] === 1
          ? 'started'
          : 'approved'
        : path.endsWith('/document/front')
          ? 'document_submitted'
          : path.endsWith('/liveness')
            ? 'liveness_submitted'
            : path.endsWith('/complete')
              ? 'processing'
              : 'started'
      const data: Record<string, unknown> = { id: 's1', status, expires_at: '2099-01-01' }
      if (path.endsWith('/session')) {
        data.capture_model = 'active'
        data.liveness_challenges = challenges
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ status: 'success', message: 'OK', code: 200, data }),
      } as Response
    })

    const { controller } = makeController({ fetch: fetchMock as never })
    const el = controller.element as unknown as FakeEl

    controller.start()
    await flush() // connect → welcome
    clickText(el, 'Get started')
    await flush()
    clickText(el, 'Passport')
    await flush()
    clickText(el, 'Continue') // front instruction
    await flush()
    clickText(el, 'Skip (demo)') // front capture (no camera → upload/skip)
    await flush()
    clickText(el, 'Continue') // active-liveness instruction
    await flush()
    // Active-liveness screen: capture_model='active' mandates a live camera, so
    // there is NO "I performed the steps" fallback on the camera-less fake DOM —
    // only the demo skip, which still submits the active challenge sequence.
    expect(find(el, 'I performed the steps')).toBeFalsy()
    clickText(el, 'Skip (demo)')
    await flush()

    expect(find(el, 'Verified')).toBeTruthy()

    const livenessCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('/liveness'))
    expect(livenessCall).toBeTruthy()
    const formBody = (livenessCall![1] as RequestInit).body as FormData
    expect(formBody.get('mode')).toBe('active')
    expect(JSON.parse(formBody.get('challenges') as string)).toEqual(challenges)
  })

  it('captures the document back for two-sided documents', async () => {
    const { controller, fetchMock } = makeController()
    controller.start()
    await flush() // connect → welcome
    clickText(controller.element as unknown as FakeEl, 'Get started')
    await flush()
    clickText(controller.element as unknown as FakeEl, 'ID Card')
    await flush()
    clickText(controller.element as unknown as FakeEl, 'Continue') // front instruction
    await flush()
    clickText(controller.element as unknown as FakeEl, 'Skip (demo)') // front
    await flush()
    clickText(controller.element as unknown as FakeEl, 'Continue') // back instruction
    await flush()
    clickText(controller.element as unknown as FakeEl, 'Skip (demo)') // back
    await flush()
    clickText(controller.element as unknown as FakeEl, 'Continue') // selfie instruction
    await flush()
    clickText(controller.element as unknown as FakeEl, 'Skip (demo)') // selfie
    await flush()

    const calls = fetchMock.mock.calls.map((c) => String(c[0]))
    expect(calls.some((c) => c.includes('/document/back'))).toBe(true)
    expect(find(controller.element as unknown as FakeEl, 'Verified')).toBeTruthy()
  })

  it('surfaces an API failure on the error screen and posts arkyc:error', async () => {
    const onError = vi.fn()
    const { fetchMock } = makeFetch({
      onCall: (key) => (key.includes('/complete') ? 'ERROR' : undefined),
    })
    const { controller, messages } = makeController({ fetch: fetchMock as never, onError })

    controller.start()
    await flush() // connect → welcome
    clickText(controller.element as unknown as FakeEl, 'Get started')
    await flush()
    clickText(controller.element as unknown as FakeEl, 'Passport')
    await flush()
    clickText(controller.element as unknown as FakeEl, 'Continue') // front instruction
    await flush()
    clickText(controller.element as unknown as FakeEl, 'Skip (demo)') // front
    await flush()
    clickText(controller.element as unknown as FakeEl, 'Continue') // selfie instruction
    await flush()
    clickText(controller.element as unknown as FakeEl, 'Skip (demo)') // selfie → liveness → complete (fails)
    await flush()

    const el = controller.element as unknown as FakeEl
    expect(find(el, 'Something went wrong')).toBeTruthy()
    // onError fires at the moment of failure, carrying the stable key — the
    // integrator learns of it without waiting for the user to dismiss the screen.
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Session expired', status: 401, error: 'session_expired' }),
    )
    // The terminal arkyc:error (which closes an embedding overlay) waits for dismissal.
    expect(messages.some((m) => m.type === 'arkyc:error')).toBe(false)

    clickText(el, 'Done')
    expect(onError).toHaveBeenCalledTimes(1) // not re-fired on dismiss
    expect(messages.some((m) => m.type === 'arkyc:error')).toBe(true)
  })

  it('notifies onError immediately when the session is already expired at load', async () => {
    const onError = vi.fn()
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      text: async () =>
        JSON.stringify({ status: 'error', message: 'Session expired', code: 401, error: 'session_expired' }),
    }))
    const { controller } = makeController({ fetch: fetchMock as never, onError })

    controller.start()
    await flush()
    await flush()

    // No user interaction: the expired session surfaces on load and onError fires.
    expect(find(controller.element as unknown as FakeEl, 'Something went wrong')).toBeTruthy()
    expect(onError).toHaveBeenCalledTimes(1)
    const err = onError.mock.calls[0]![0] as { status?: number; error?: string }
    expect(err.status).toBe(401)
    expect(err.error).toBe('session_expired')
  })

  it('shows a next-step instruction before a capture step', async () => {
    const { controller } = makeController()
    const el = controller.element as unknown as FakeEl
    controller.start()
    await flush()
    clickText(el, 'Get started')
    await flush()
    clickText(el, 'Passport')
    await flush()
    // The camera doesn't spring up immediately: an instruction screen leads it.
    expect(find(el, 'Front of your document')).toBeTruthy()
    expect(find(el, 'Continue')).toBeTruthy()
  })

  it('shows a close-only notice when the session is already terminal on load', async () => {
    const fetchMock = vi.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              status: 'success',
              message: 'OK',
              code: 200,
              data: { id: 's1', status: 'expired', expires_at: '2099-01-01' },
            }),
        }) as Response,
    )
    const onClose = vi.fn()
    const onComplete = vi.fn()
    const { controller } = makeController({ fetch: fetchMock as never, onClose, onComplete })
    const el = controller.element as unknown as FakeEl

    controller.start()
    await flush()
    expect(find(el, 'Link expired')).toBeTruthy()
    expect(find(el, 'Get started')).toBeFalsy()
    expect(find(el, 'Done')).toBeFalsy() // close-only — no continue/acknowledge
    // A non-decision terminal (expired) isn't a completion — nothing is surfaced.
    expect(onComplete).not.toHaveBeenCalled()
    clickText(el, 'Close')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('surfaces onComplete + the complete event when the session is already decided on load', async () => {
    const fetchMock = vi.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              status: 'success',
              message: 'OK',
              code: 200,
              data: { id: 's1', status: 'approved', expires_at: '2099-01-01' },
            }),
        }) as Response,
    )
    const onComplete = vi.fn()
    const onClose = vi.fn()
    const events: WidgetEvent[] = []
    const { controller, messages } = makeController({
      fetch: fetchMock as never,
      onComplete,
      onClose,
      onEvent: (e) => events.push(e),
    })
    const el = controller.element as unknown as FakeEl

    controller.start()
    await flush()

    // The already-decided outcome is delivered immediately — no dismissal needed.
    expect(find(el, 'Already complete')).toBeTruthy()
    expect(find(el, 'Done')).toBeFalsy() // still close-only UI
    expect(onComplete).toHaveBeenCalledWith({ status: 'approved', decision: 'approved' })
    expect(events.some((e) => e.name === 'complete')).toBe(true)
    // The non-closing `complete` event forwards to a parent; the terminal
    // `arkyc:complete` (which tears an embedding overlay down) still waits for Close.
    expect(messages).not.toContainEqual(expect.objectContaining({ type: 'arkyc:complete' }))

    // Closing the notice tears down as before, without re-firing completion.
    clickText(el, 'Close')
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(messages).toContainEqual({ type: 'arkyc:close' })
  })

  it('closes via the header button, firing onClose + arkyc:close', () => {
    const onClose = vi.fn()
    const { controller, messages } = makeController({ onClose })
    controller.start()
    const closeBtn = findByAttr(controller.element as unknown as FakeEl, 'aria-label', 'Close')
    expect(closeBtn).toBeTruthy()
    closeBtn!.click()
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(messages).toContainEqual({ type: 'arkyc:close' })
  })
})

describe('WidgetController cross-device handoff', () => {
  type Handoff = { enabled: boolean; allow_desktop: boolean; url: string }
  /** A fetch whose `/session` carries the server handoff config; approves after N reads. */
  function handoffFetch(handoff: Handoff, approveAfter = Infinity) {
    const counts: Record<string, number> = {}
    return vi.fn(async (url: string, init?: RequestInit) => {
      const path = String(url).replace(/^https?:\/\/[^/]+/, '')
      const key = `${init?.method ?? 'GET'} ${path}`
      counts[key] = (counts[key] ?? 0) + 1
      const isSession = path.endsWith('/session')
      const status = isSession && counts[key] > approveAfter ? 'approved' : 'started'
      const data: Record<string, unknown> = { id: 's1', status, expires_at: '2099-01-01' }
      if (isSession) data.handoff = handoff
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ status: 'success', message: 'OK', code: 200, data }),
      } as Response
    })
  }

  const URL = 'https://verify.test/verify'
  const desktopNav = { userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 0 } as Navigator
  const phoneNav = { userAgent: 'Mozilla/5.0 (iPhone)', platform: 'iPhone', maxTouchPoints: 5 } as Navigator
  const handoffWin = () =>
    ({ parent: { postMessage: () => {} }, location: { search: '', origin: 'https://desk.test' } }) as unknown as Window

  it('leads with the QR on desktop and offers continuing on this device', async () => {
    // Session never reaches terminal, so the QR screen persists while we assert.
    const fetchMock = handoffFetch({ enabled: true, allow_desktop: true, url: URL })
    const { controller } = makeController({
      fetch: fetchMock as never,
      nav: desktopNav,
      win: handoffWin(),
      maxHandoffPolls: 2,
    })
    const el = controller.element as unknown as FakeEl

    controller.start() // desktop → connecting → bootstrap → QR (no welcome click)
    await flush()

    const qr = findByClass(el, 'arkyc-qr')
    expect(qr?.innerHTML.includes('<svg')).toBe(true)
    expect(find(el, 'Continue on this device')).toBeTruthy()
    // No "Get started" yet — the QR is the first screen on desktop.
    expect(find(el, 'Get started')).toBeFalsy()
  })

  it('mirrors the result completed on the other device', async () => {
    const fetchMock = handoffFetch({ enabled: true, allow_desktop: true, url: URL }, 1)
    const { controller } = makeController({ fetch: fetchMock as never, nav: desktopNav, win: handoffWin() })
    const el = controller.element as unknown as FakeEl
    controller.start()
    await flush()
    await flush() // polling sees the session reach approved
    expect(find(el, 'Verified')).toBeTruthy()
  })

  it('forces the phone when the project forbids continuing on desktop', async () => {
    const fetchMock = handoffFetch({ enabled: true, allow_desktop: false, url: URL })
    const { controller } = makeController({
      fetch: fetchMock as never,
      nav: desktopNav,
      win: handoffWin(),
      maxHandoffPolls: 2,
    })
    const el = controller.element as unknown as FakeEl
    controller.start()
    await flush()
    expect(findByClass(el, 'arkyc-qr')).toBeTruthy()
    expect(find(el, 'Continue on this device')).toBeFalsy()
  })

  it('starts at the welcome screen on desktop when handoff is disabled', async () => {
    const fetchMock = handoffFetch({ enabled: false, allow_desktop: true, url: URL })
    const { controller } = makeController({ fetch: fetchMock as never, nav: desktopNav, win: handoffWin() })
    const el = controller.element as unknown as FakeEl
    controller.start()
    await flush()
    expect(find(el, 'Get started')).toBeTruthy()
    expect(findByClass(el, 'arkyc-qr')).toBeFalsy()
  })

  it('never shows handoff on a phone (welcome first)', async () => {
    const fetchMock = handoffFetch({ enabled: true, allow_desktop: true, url: URL })
    const { controller } = makeController({ fetch: fetchMock as never, nav: phoneNav, win: handoffWin() })
    const el = controller.element as unknown as FakeEl
    controller.start()
    await flush() // connect → welcome (no QR detour on a phone)
    expect(find(el, 'Get started')).toBeTruthy()
    expect(findByClass(el, 'arkyc-qr')).toBeFalsy()
  })
})

describe('composeHandoffUrl', () => {
  const target = 'https://verify.test/verify'

  it('always carries the token', () => {
    expect(composeHandoffUrl(target, 'ct', 'https://api.arkyc.net/api/v1/client', 'https://app.test')).toContain(
      'token=ct',
    )
  })

  it('forwards a cross-origin API base the phone can reach', () => {
    const url = composeHandoffUrl(target, 'ct', 'https://api.example.com/api/v1/client', 'https://app.test')
    expect(url).toContain(`baseUrl=${encodeURIComponent('https://api.example.com/api/v1/client')}`)
  })

  it('skips a same-origin (proxy) base the phone cannot use', () => {
    const url = composeHandoffUrl(target, 'ct', 'https://app.test/api/v1/client', 'https://app.test')
    expect(url).not.toContain('baseUrl=')
  })

  it('appends with & when the target already has a query', () => {
    const url = composeHandoffUrl(`${target}?ref=1`, 'ct', 'https://api.example.com', 'https://app.test')
    expect(url).toContain('?ref=1&token=ct')
  })
})

describe('WidgetController realtime events', () => {
  const desktopNav = { userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 0 } as Navigator
  const handoffWin = () =>
    ({ parent: { postMessage: () => {} }, location: { search: '', origin: 'https://desk.test' } }) as unknown as Window

  it('streams session.transition + complete through the onEvent firehose (polling)', async () => {
    const events: WidgetEvent[] = []
    const { controller } = makeController({ onEvent: (e) => events.push(e) })
    const el = controller.element as unknown as FakeEl

    controller.start()
    await flush()
    clickText(el, 'Get started')
    await flush()
    clickText(el, 'Passport')
    await flush()
    clickText(el, 'Continue') // front instruction
    await flush()
    clickText(el, 'Skip (demo)') // front
    await flush()
    clickText(el, 'Continue') // selfie instruction
    await flush()
    clickText(el, 'Skip (demo)') // selfie → liveness → complete → poll → approved
    await flush()
    clickText(el, 'Done')

    const names = events.map((e) => e.name)
    // The bootstrap 'started' and the finalising 'approved' both surface.
    expect(names.filter((n) => n === 'session.transition').length).toBeGreaterThanOrEqual(2)
    expect(names).toContain('complete')
    const transition = events.find((e) => e.name === 'session.transition')!.data as { status: string }
    expect(transition.status).toBe('started')
  })

  it('uses the configured push transport and respects on()/unsubscribe', async () => {
    let pushHandler: ((event: string, data: unknown) => void) | null = null
    const fakeClient = {
      subscribe: (_channel: string, handler: (event: string, data: unknown) => void) => {
        pushHandler = handler
        return () => {}
      },
      disconnect: () => {},
    }
    const realtimeFactory = vi.fn(async () => fakeClient)

    // Desktop + handoff → the widget waits on the push transport (never polls to
    // terminal here because the scheduler never fires).
    const fetchMock = vi.fn(async (url: string) => {
      const path = String(url).replace(/^https?:\/\/[^/]+/, '')
      const data: Record<string, unknown> = { id: 's1', status: 'started', expires_at: '2099-01-01' }
      if (path.endsWith('/session')) {
        data.handoff = { enabled: true, allow_desktop: true, url: 'https://verify.test/verify' }
        data.realtime = { transport: 'pusher', channel: 'private-session-s1' }
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ status: 'success', message: 'OK', code: 200, data }),
      } as Response
    })

    const events: WidgetEvent[] = []
    const { controller } = makeController({
      fetch: fetchMock as never,
      nav: desktopNav,
      win: handoffWin(),
      realtimeFactory,
      onEvent: (e) => events.push(e),
      scheduler: () => {}, // freeze the poll backstop so only the push event resolves
      maxHandoffPolls: 5,
    })
    const el = controller.element as unknown as FakeEl

    // A named listener we'll unsubscribe before the terminal event.
    const named: unknown[] = []
    const off = controller.on('session.transition', (d) => named.push(d))

    controller.start()
    await flush()
    await flush()
    await flush()

    expect(realtimeFactory).toHaveBeenCalledTimes(1)
    // Zero-config (no baseUrl): the auth endpoint is built from the resolved
    // hosted base, not the page origin (regression guard).
    const authOpts = realtimeFactory.mock.calls[0]![1] as { authEndpoint: string }
    expect(authOpts.authEndpoint).toBe('https://api.arkyc.toneflix.net/api/v1/client/realtime/auth')
    expect(pushHandler).toBeTruthy()
    expect(named.length).toBeGreaterThan(0) // got the bootstrap 'started' transition

    off() // unsubscribe — must receive nothing further
    const namedAfterOff = named.length

    pushHandler!('session.transition', { status: 'approved' })
    await flush()

    expect(find(el, 'Verified')).toBeTruthy()
    // The firehose still saw the approved transition; the unsubscribed listener didn't.
    expect(
      events.some((e) => e.name === 'session.transition' && (e.data as { status: string }).status === 'approved'),
    ).toBe(true)
    expect(named.length).toBe(namedAfterOff)
  })

  it('builds the realtime auth endpoint from an explicit baseUrl', async () => {
    const realtimeFactory = vi.fn(async () => ({ subscribe: () => () => {}, disconnect: () => {} }))
    const fetchMock = vi.fn(async (url: string) => {
      const path = String(url)
        .replace(/^https?:\/\/[^/]+/, '')
        .replace(/^\/api\/v1\/client/, '')
      const data: Record<string, unknown> = { id: 's1', status: 'started', expires_at: '2099-01-01' }
      if (path.endsWith('/session')) {
        data.handoff = { enabled: true, allow_desktop: true, url: 'https://verify.test/verify' }
        data.realtime = { transport: 'pusher', channel: 'private-session-s1' }
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ status: 'success', message: 'OK', code: 200, data }),
      } as Response
    })

    const { controller } = makeController({
      fetch: fetchMock as never,
      nav: desktopNav,
      win: handoffWin(),
      realtimeFactory,
      baseUrl: 'https://api.example.com/api/v1/client',
      scheduler: () => {},
      maxHandoffPolls: 5,
    })

    controller.start()
    await flush()
    await flush()

    expect(realtimeFactory).toHaveBeenCalledTimes(1)
    const opts = realtimeFactory.mock.calls[0]![1] as { authEndpoint: string }
    expect(opts.authEndpoint).toBe('https://api.example.com/api/v1/client/realtime/auth')
  })
})

describe('WidgetController branding', () => {
  /** Find the first element of the given tag name. */
  function findTag(root: FakeEl, tag: string): FakeEl | undefined {
    if (root.tagName === tag) return root
    for (const child of root.children) {
      const hit = findTag(child, tag)
      if (hit) return hit
    }
    return undefined
  }

  it('themes the widget from the project branding in the session response', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const path = String(url).replace(/^https?:\/\/[^/]+/, '')
      const data: Record<string, unknown> = { id: 's1', status: 'started', expires_at: '2099-01-01' }
      if (path.endsWith('/session')) {
        data.branding = { primary_color: '#123456', name: 'Acme Inc', show_branding: true }
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ status: 'success', message: 'OK', code: 200, data }),
      } as Response
    })
    const { controller } = makeController({ fetch: fetchMock as never })
    const el = controller.element as unknown as FakeEl

    controller.start()
    await flush()

    // The stylesheet picked up the project's primary colour…
    const style = findTag(el, 'style')!
    expect(style.textContent).toContain('#123456')
    // …and the header shows the project name.
    expect(find(el, 'Acme Inc')).toBeTruthy()
  })

  it('lets integrator-provided branding win over the server', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const path = String(url).replace(/^https?:\/\/[^/]+/, '')
      const data: Record<string, unknown> = { id: 's1', status: 'started', expires_at: '2099-01-01' }
      if (path.endsWith('/session')) data.branding = { primary_color: '#123456', name: 'Server Co' }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ status: 'success', message: 'OK', code: 200, data }),
      } as Response
    })
    const { controller } = makeController({
      fetch: fetchMock as never,
      branding: { primary_color: '#abcdef', name: 'Integrator Co', show_branding: true },
    })
    const el = controller.element as unknown as FakeEl

    controller.start()
    await flush()

    const style = findTag(el, 'style')!
    expect(style.textContent).toContain('#abcdef')
    expect(style.textContent).not.toContain('#123456')
    expect(find(el, 'Integrator Co')).toBeTruthy()
  })
})

describe('ArkycWidget launchers', () => {
  it('open() mounts an overlay on the body and close() removes it', () => {
    const { doc, body } = makeDoc()
    const win = { parent: {}, location: { search: '' } } as unknown as Window
    const handle = ArkycWidget.open({
      token: 'ct',
      doc,
      win,
      nav: {} as Navigator,
      fetch: (async () => ({ ok: true, status: 200, text: async () => '{}' })) as never,
    })
    expect(body.children.length).toBe(1)
    expect(body.children[0].attributes['data-arkyc-widget']).toBe('')

    handle.close()
    expect(body.children.length).toBe(0)
  })

  it('mount() requires an existing container', () => {
    const { doc } = makeDoc()
    expect(() =>
      ArkycWidget.mount({
        token: 'ct',
        container: '#missing',
        doc,
        win: {} as Window,
        nav: {} as Navigator,
      }),
    ).toThrow(/container/)
  })

  it('mount() takes ownership of the container so it renders reliably', () => {
    const { doc } = makeDoc()
    const container = doc.createElement('div') as unknown as FakeEl
    const handle = ArkycWidget.mount({
      token: 'ct',
      container: container as unknown as HTMLElement,
      doc,
      win: { location: { search: '' } } as unknown as Window,
      nav: {} as Navigator,
      fetch: (async () => ({ ok: true, status: 200, text: async () => '{}' })) as never,
    })

    // Widget appended, and the host was given its own stacking context above
    // sibling app content (the fix for a container hidden under an app root).
    expect(container.children.length).toBe(1)
    expect(container.style.position).toBe('relative')
    expect(container.style.zIndex).toBe('1')
    expect(container.style.isolation).toBe('isolate')
    expect(container.children[0].className).toContain('arkyc-inline')

    handle.close()
    expect(container.children.length).toBe(0)
  })

  it('mount() does not override a container that already sets position/z-index', () => {
    const { doc } = makeDoc()
    const container = doc.createElement('div') as unknown as FakeEl
    container.style.position = 'absolute'
    container.style.zIndex = '5'
    ArkycWidget.mount({
      token: 'ct',
      container: container as unknown as HTMLElement,
      doc,
      win: { location: { search: '' } } as unknown as Window,
      nav: {} as Navigator,
      fetch: (async () => ({ ok: true, status: 200, text: async () => '{}' })) as never,
    })

    expect(container.style.position).toBe('absolute')
    expect(container.style.zIndex).toBe('5')
  })

  it('hosted() reads the token from the query string', () => {
    const { doc, body } = makeDoc()
    const win = {
      parent: {},
      location: { search: '?token=ct_hosted&baseUrl=https://api.test' },
    } as unknown as Window
    ArkycWidget.hosted({
      doc,
      win,
      nav: {} as Navigator,
      fetch: (async () => ({ ok: true, status: 200, text: async () => '{}' })) as never,
    })
    expect(body.children.length).toBe(1)
  })
})
