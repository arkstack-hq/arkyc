import { ArkycWidget } from '@arkyc/widget'
import type { WidgetEvent } from '@arkyc/widget'

/** Server-side shape returned by `POST /pg/session`. */
interface StartResponse {
  clientToken: string
  session: { id: string }
  error?: string
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
const eventsEl = $('events')
const eventCountEl = $('event-count')

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

    resetEvents()

    ArkycWidget.mount({
      token: data.clientToken,
      container: widgetEl,
      // Same-origin: Vite proxies /api → the Arkyc API (see vite.config.ts).
      baseUrl: '/api',
      onEvent: (event) => {
        renderEvent(event)
        console.log(event)
        if (event.name === 'session.transition') {
          const status = (event.data as { status?: string })?.status
          if (status) setStatus(`Status: ${status}`, 'busy')
        }
      },
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

// How many widget events have landed this run.
let eventCount = 0

/** Clear the live-events panel for a fresh run. */
function resetEvents(): void {
  eventCount = 0
  eventCountEl.textContent = '0'
  eventsEl.innerHTML = '<p class="hint">None yet.</p>'
}

/** Prepend a widget event (newest on top) to the live-events panel. */
function renderEvent(event: WidgetEvent): void {
  if (eventCount === 0) eventsEl.replaceChildren()
  eventCount += 1
  eventCountEl.textContent = String(eventCount)

  const wrap = document.createElement('details')
  wrap.className = 'webhook'
  const summary = document.createElement('summary')
  summary.innerHTML =
    `<span class="webhook__name">${event.name}</span>` +
    `<span class="webhook__meta">${new Date().toLocaleTimeString()}</span>`
  const body = document.createElement('pre')
  body.textContent = JSON.stringify(event.data ?? {}, null, 2)
  wrap.append(summary, body)
  eventsEl.prepend(wrap)
}

startBtn.addEventListener('click', () => void startVerification())
resetEvents()
