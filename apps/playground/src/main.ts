import { ArkycWidget } from '@arkyc/widget'

/** Server-side shape returned by `POST /pg/session`. */
interface StartResponse {
  clientToken: string
  session: { id: string }
  error?: string
}

interface ReceivedWebhook {
  receivedAt: string
  verified: boolean | null
  event: unknown
}

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id)
  if (!el) throw new Error(`Missing element #${id}`)
  return el as T
}

const startBtn = $<HTMLButtonElement>('start')
const statusEl = $('status')
const widgetEl = $('widget')
const resultEl = $('result')
const webhooksEl = $('webhooks')
const webhookCountEl = $('webhook-count')

function setStatus(message: string, tone: 'idle' | 'busy' | 'ok' | 'error' = 'idle'): void {
  statusEl.textContent = message
  statusEl.dataset.tone = tone
}

async function startVerification(): Promise<void> {
  startBtn.disabled = true
  widgetEl.replaceChildren()
  resultEl.textContent = 'No result yet.'
  setStatus('Creating session…', 'busy')

  try {
    const res = await fetch('/pg/session', { method: 'POST' })
    const data = (await res.json()) as StartResponse
    if (!res.ok) throw new Error(data.error || `Failed to create session (${res.status})`)

    setStatus(`Session ${data.session.id} created — complete the flow below.`, 'busy')

    ArkycWidget.mount({
      token: data.clientToken,
      container: widgetEl,
      // Same-origin: Vite proxies /api → the Arkyc API (see vite.config.ts).
      baseUrl: '/api',
      onComplete: (result) => {
        setStatus(`Done: ${result.status}${result.decision ? ` (${result.decision})` : ''}.`, 'ok')
        void showResult(data.session.id)
      },
      onError: (err) => setStatus(`Widget error: ${err.message}`, 'error'),
      onClose: () => {
        if (statusEl.dataset.tone === 'busy') setStatus('Widget closed before completion.', 'idle')
      },
    })
  } catch (err) {
    setStatus((err as Error).message, 'error')
  } finally {
    startBtn.disabled = false
  }
}

/** Re-fetch the session server-side to show its authoritative decision. */
async function showResult(sessionId: string): Promise<void> {
  try {
    const res = await fetch(`/pg/session/${encodeURIComponent(sessionId)}`)
    const data = (await res.json()) as { session?: unknown; error?: string }
    if (!res.ok) throw new Error(data.error || `Failed to fetch session (${res.status})`)
    resultEl.textContent = JSON.stringify(data.session, null, 2)
  } catch (err) {
    resultEl.textContent = (err as Error).message
  }
}

function renderWebhooks(hooks: ReceivedWebhook[]): void {
  webhookCountEl.textContent = String(hooks.length)
  if (hooks.length === 0) {
    webhooksEl.innerHTML = '<p class="hint">None received yet.</p>'
    return
  }
  webhooksEl.replaceChildren(
    ...hooks.map((hook) => {
      const event = hook.event as { event?: string; status?: string } | string
      const name = typeof event === 'object' && event.event ? event.event : 'webhook'
      const verified =
        hook.verified === null ? 'unverified' : hook.verified ? 'verified ✓' : 'invalid ✗'

      const wrap = document.createElement('details')
      wrap.className = 'webhook'
      wrap.dataset.verified = String(hook.verified)
      const summary = document.createElement('summary')
      summary.innerHTML =
        `<span class="webhook__name">${name}</span>` +
        `<span class="webhook__meta">${verified} · ${new Date(hook.receivedAt).toLocaleTimeString()}</span>`
      const body = document.createElement('pre')
      body.textContent = JSON.stringify(hook.event, null, 2)
      wrap.append(summary, body)
      return wrap
    }),
  )
}

async function pollWebhooks(): Promise<void> {
  try {
    const res = await fetch('/pg/webhooks')
    const data = (await res.json()) as { webhooks: ReceivedWebhook[] }
    renderWebhooks(data.webhooks)
  } catch {
    /* dev server momentarily unavailable — ignore */
  }
}

startBtn.addEventListener('click', () => void startVerification())
void pollWebhooks()
setInterval(() => void pollWebhooks(), 2000)
