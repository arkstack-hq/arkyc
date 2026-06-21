import { describe, expect, it, vi } from 'vitest';
import { ArkycWidget } from '../src/index';
import { WidgetController } from '../src/controller';

// --- Minimal fake DOM (the widget core is DOM-injectable, so no jsdom needed) ---

class FakeEl {
  tagName: string;
  children: FakeEl[] = [];
  listeners: Record<string, Array<() => void>> = {};
  attributes: Record<string, string> = {};
  style: Record<string, string> = {};
  className = '';
  textContent = '';
  innerHTML = '';
  value = '';
  src = '';
  parent: FakeEl | null = null;

  constructor(tag: string) {
    this.tagName = tag;
  }

  appendChild(child: FakeEl): FakeEl {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  removeChild(child: FakeEl): void {
    this.children = this.children.filter((c) => c !== child);
  }

  remove(): void {
    this.parent?.removeChild(this);
  }

  get firstChild(): FakeEl | null {
    return this.children[0] ?? null;
  }

  setAttribute(key: string, value: string): void {
    this.attributes[key] = value;
  }

  addEventListener(type: string, fn: () => void): void {
    (this.listeners[type] ??= []).push(fn);
  }

  click(): void {
    (this.listeners.click ?? []).forEach((fn) => fn());
  }

  get classList() {
    return {
      add: (cls: string) => {
        this.className += (this.className ? ' ' : '') + cls;
      },
    };
  }

  querySelector(): FakeEl | null {
    return null;
  }
}

function makeDoc() {
  const body = new FakeEl('body');
  const doc = {
    body,
    createElement: (tag: string) => new FakeEl(tag),
    querySelector: (_sel: string) => null,
  } as unknown as Document;
  return { doc, body };
}

/** Recursively find the first element whose trimmed text equals `text`. */
function find(root: FakeEl, text: string): FakeEl | undefined {
  if (root.textContent.trim() === text) return root;
  for (const child of root.children) {
    const hit = find(child, text);
    if (hit) return hit;
  }
  return undefined;
}

function clickText(root: FakeEl, text: string): void {
  const el = find(root, text);
  if (!el) throw new Error(`No element with text "${text}"`);
  el.click();
}

/** Recursively find the first element with an attribute equal to `value`. */
function findByAttr(root: FakeEl, attr: string, value: string): FakeEl | undefined {
  if (root.attributes[attr] === value) return root;
  for (const child of root.children) {
    const hit = findByAttr(child, attr, value);
    if (hit) return hit;
  }
  return undefined;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

function makeFetch(script: { onCall?: (key: string, n: number) => string | undefined } = {}) {
  const counts: Record<string, number> = {};
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const path = String(url).replace(/^https?:\/\/[^/]+/, '');
    const key = `${method} ${path}`;
    counts[key] = (counts[key] ?? 0) + 1;

    const override = script.onCall?.(key, counts[key]);
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
              : 'started');

    const ok = status !== 'ERROR';
    return {
      ok,
      status: ok ? 200 : 401,
      text: async () =>
        JSON.stringify({
          status: ok ? 'success' : 'error',
          message: ok ? 'OK' : 'Session expired',
          code: ok ? 200 : 401,
          data: ok ? { id: 's1', status, expires_at: '2099-01-01' } : null,
        }),
    } as Response;
  });
  return { fetchMock, counts };
}

function makeController(over: Partial<ConstructorParameters<typeof WidgetController>[0]> = {}) {
  const { doc, body } = makeDoc();
  const messages: Array<Record<string, unknown>> = [];
  const win = {
    parent: { postMessage: (m: Record<string, unknown>) => messages.push(m) },
    location: { search: '' },
  } as unknown as Window;
  const nav = {} as Navigator; // no mediaDevices → camera unsupported → Upload/Skip path

  const { fetchMock } = makeFetch();
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
  });
  body.appendChild(controller.element);
  return { controller, body, messages, fetchMock, win };
}

describe('WidgetController flow', () => {
  it('walks a passport verification to an approved result and posts arkyc:complete', async () => {
    const onComplete = vi.fn();
    const { controller, messages, fetchMock } = makeController({ onComplete });

    controller.start();
    clickText(controller.element as unknown as FakeEl, 'Get started');
    await flush();
    clickText(controller.element as unknown as FakeEl, 'Passport');
    await flush();
    clickText(controller.element as unknown as FakeEl, 'Skip (demo)'); // front capture
    await flush();
    clickText(controller.element as unknown as FakeEl, 'Skip (demo)'); // selfie capture
    await flush();

    // Lands on the result screen.
    expect(find(controller.element as unknown as FakeEl, 'Verified')).toBeTruthy();

    // No back-capture call for a passport.
    const calls = fetchMock.mock.calls.map((c) => `${(c[1] as RequestInit).method} ${String(c[0])}`);
    expect(calls.some((c) => c.includes('/document/back'))).toBe(false);
    expect(calls.some((c) => c.includes('/document/front'))).toBe(true);
    expect(calls.some((c) => c.includes('/liveness'))).toBe(true);
    expect(calls.some((c) => c.includes('/complete'))).toBe(true);

    // Completion is delivered when the user acknowledges the result.
    expect(onComplete).not.toHaveBeenCalled();
    clickText(controller.element as unknown as FakeEl, 'Done');
    expect(onComplete).toHaveBeenCalledWith({ status: 'approved', decision: 'approved' });
    expect(messages).toContainEqual({
      type: 'arkyc:complete',
      payload: { status: 'approved', decision: 'approved' },
    });
  });

  it('captures the document back for two-sided documents', async () => {
    const { controller, fetchMock } = makeController();
    controller.start();
    clickText(controller.element as unknown as FakeEl, 'Get started');
    await flush();
    clickText(controller.element as unknown as FakeEl, 'ID Card');
    await flush();
    clickText(controller.element as unknown as FakeEl, 'Skip (demo)'); // front
    await flush();
    clickText(controller.element as unknown as FakeEl, 'Skip (demo)'); // back
    await flush();
    clickText(controller.element as unknown as FakeEl, 'Skip (demo)'); // selfie
    await flush();

    const calls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(calls.some((c) => c.includes('/document/back'))).toBe(true);
    expect(find(controller.element as unknown as FakeEl, 'Verified')).toBeTruthy();
  });

  it('surfaces an API failure on the error screen and posts arkyc:error', async () => {
    const onError = vi.fn();
    const { fetchMock } = makeFetch({ onCall: (key) => (key.includes('/complete') ? 'ERROR' : undefined) });
    const { controller, messages } = makeController({ fetch: fetchMock as never, onError });

    controller.start();
    clickText(controller.element as unknown as FakeEl, 'Get started');
    await flush();
    clickText(controller.element as unknown as FakeEl, 'Passport');
    await flush();
    clickText(controller.element as unknown as FakeEl, 'Skip (demo)'); // front
    await flush();
    clickText(controller.element as unknown as FakeEl, 'Skip (demo)'); // selfie → liveness → complete (fails)
    await flush();

    expect(find(controller.element as unknown as FakeEl, 'Something went wrong')).toBeTruthy();
    clickText(controller.element as unknown as FakeEl, 'Done');
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Session expired' }));
    expect(messages.some((m) => m.type === 'arkyc:error')).toBe(true);
  });

  it('closes via the header button, firing onClose + arkyc:close', () => {
    const onClose = vi.fn();
    const { controller, messages } = makeController({ onClose });
    controller.start();
    const closeBtn = findByAttr(controller.element as unknown as FakeEl, 'aria-label', 'Close');
    expect(closeBtn).toBeTruthy();
    closeBtn!.click();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(messages).toContainEqual({ type: 'arkyc:close' });
  });
});

describe('ArkycWidget launchers', () => {
  it('open() mounts an overlay on the body and close() removes it', () => {
    const { doc, body } = makeDoc();
    const win = { parent: {}, location: { search: '' } } as unknown as Window;
    const handle = ArkycWidget.open({
      token: 'ct',
      doc,
      win,
      nav: {} as Navigator,
      fetch: (async () => ({ ok: true, status: 200, text: async () => '{}' })) as never,
    });
    expect(body.children.length).toBe(1);
    expect(body.children[0].attributes['data-arkyc-widget']).toBe('');

    handle.close();
    expect(body.children.length).toBe(0);
  });

  it('mount() requires an existing container', () => {
    const { doc } = makeDoc();
    expect(() =>
      ArkycWidget.mount({ token: 'ct', container: '#missing', doc, win: {} as Window, nav: {} as Navigator }),
    ).toThrow(/container/);
  });

  it('hosted() reads the token from the query string', () => {
    const { doc, body } = makeDoc();
    const win = {
      parent: {},
      location: { search: '?token=ct_hosted&baseUrl=https://api.test' },
    } as unknown as Window;
    ArkycWidget.hosted({
      doc,
      win,
      nav: {} as Navigator,
      fetch: (async () => ({ ok: true, status: 200, text: async () => '{}' })) as never,
    });
    expect(body.children.length).toBe(1);
  });
});
