import { settings } from './GlobalSettingsService'
import { version } from '../../../package.json'

/**
 * A single config value as shown on the admin "Environment" panel.
 *
 * `status` drives how the dashboard renders it:
 * - `ok`     — a plain, non-sensitive value
 * - `warn`   — an insecure default / likely-misconfigured value to draw the eye
 * - `set`    — a secret that IS configured (the value itself is never sent)
 * - `unset`  — a secret/optional value that is NOT configured
 */
export interface EnvItem {
  label: string
  value: string
  status: 'ok' | 'warn' | 'set' | 'unset'
}

/** A titled group of related config values. */
export interface EnvSection {
  title: string
  items: EnvItem[]
}

/** The full, secret-safe runtime-config snapshot for the admin panel. */
export interface EnvironmentSnapshot {
  generated_at: string
  node_env: string
  version: string
  sections: EnvSection[]
}

/**
 * Values that mean "a real secret was never set" — framework placeholders and
 * obvious dev defaults. A secret matching one of these is reported `unset`.
 */
const PLACEHOLDERS = new Set([
  '',
  'change-me',
  'password',
  'secret',
  'arkyc-secret',
  'arkyc-key',
  'no-reply@example.com',
])

const str = (value: unknown): string => String(value ?? '').trim()

/** Is this secret meaningfully configured (non-empty and not a known placeholder)? */
const isSet = (value: unknown): boolean => !PLACEHOLDERS.has(str(value).toLowerCase())

/** A plain value row; blank values render as `—`. */
const ok = (label: string, value: unknown): EnvItem => ({ label, value: str(value) || '—', status: 'ok' })

/** A secret row — the value is collapsed to a configured/not-set indicator. */
const secret = (label: string, value: unknown): EnvItem =>
  isSet(value) ? { label, value: 'Configured', status: 'set' } : { label, value: 'Not set', status: 'unset' }

/**
 * Assemble a read-only snapshot of the API's effective runtime configuration so
 * platform admins can spot drift between environments at a glance. Secrets
 * (keys, passwords, tokens) are reported only as configured/not-set — their
 * values never leave the server.
 */
export async function buildEnvironmentSnapshot(): Promise<EnvironmentSnapshot> {
  const nodeEnv = str(process.env.NODE_ENV) || 'development'

  const app = config('app')
  const db = config('database')
  const conn = db.connections[db.default as keyof typeof db.connections] ?? db.connections.pgsql
  const cache = config('cache')
  const queue = config('queue')
  const filesystem = config('filesystem')
  const session = config('session')
  const realtime = config('realtime')
  const notifications = config('notifications')
  const smtp = notifications.transports.smtp
  const mailDriver = notifications.drivers.mail

  const current = await settings.current()

  // The app key being the framework placeholder is the single clearest "this
  // environment was never finished" signal — surface it as a warning.
  const appKeyItem: EnvItem = isSet(app.key)
    ? { label: 'App key', value: 'Configured', status: 'set' }
    : { label: 'App key', value: 'Insecure default', status: 'warn' }

  // `mock` analyzer drivers return fixed demo fields — fine for dev, a real
  // problem in production, so warn when one is left in place there.
  const driver = (label: string, value: unknown): EnvItem => {
    const name = str(value) || 'mock'

    return { label, value: name, status: nodeEnv === 'production' && name === 'mock' ? 'warn' : 'ok' }
  }

  const sections: EnvSection[] = [
    {
      title: 'Application',
      items: [
        ok('App env', app.env),
        ok('Node env', nodeEnv),
        ok('Name', app.name),
        ok('App URL', app.url),
        ok('Frontend URL', app.frontend_url),
        ok('Website URL', app.website_url),
        appKeyItem,
      ],
    },
    {
      title: 'Database',
      items: [
        ok('Connection', db.default),
        ok('Driver', conn.driver),
        isSet(conn.url) ? { label: 'Source', value: 'DATABASE_URL', status: 'ok' } : ok('Host', conn.host),
        ok('Port', conn.port),
        ok('Database', conn.database),
        ok('User', conn.user),
        secret('Password', conn.password),
      ],
    },
    {
      title: 'Cache & queue',
      items: [
        ok('Cache store', cache.default),
        ok('Cache prefix', cache.prefix),
        ok('Queue connection', queue.default),
      ],
    },
    {
      title: 'Storage',
      items: [
        ok('Default disk', filesystem.default),
        secret('S3 bucket', filesystem.disks.s3?.bucket),
        secret('GCS bucket', filesystem.disks.gcs?.bucket),
      ],
    },
    {
      title: 'Document analysis',
      items: [
        driver('OCR driver', env('OCR_DRIVER', 'mock')),
        driver('OCR fallback', env('OCR_FALLBACK_DRIVER', 'mock')),
        ok('OCR language', env('OCR_LANGUAGE', 'eng')),
        ok('AI model', env('OCR_AI_MODEL') ?? '—'),
        ok('AI endpoint', env('OCR_ENDPOINT') ?? 'default'),
        secret('AI API key', env('OCR_API_KEY')),
        driver('Liveness driver', env('LIVENESS_DRIVER', 'mock')),
        driver('Face-match driver', env('FACE_MATCH_DRIVER', 'mock')),
      ],
    },
    {
      title: 'Realtime',
      items: [
        ok('Active transport', current.realtime.transport),
        ok('Env transport', process.env.REALTIME_TRANSPORT ?? 'off'),
        ok('Pusher host', realtime.pusher?.host ?? 'hosted'),
        ok('Pusher cluster', realtime.pusher?.cluster),
        secret('Firebase project', realtime.firebase?.projectId),
      ],
    },
    {
      title: 'Mail',
      items: [
        ok('Driver', notifications.default_driver),
        ok('Transport', mailDriver.transport),
        ok('Host', smtp.host),
        ok('Port', smtp.port),
        { label: 'Secure (TLS)', value: smtp.secure ? 'true' : 'false', status: 'ok' },
        ok('From', mailDriver.from),
        secret('Username', smtp.auth?.user),
        secret('Password', smtp.auth?.pass),
        ok('Test address', mailDriver.test_address ?? '—'),
      ],
    },
    {
      title: 'Session',
      items: [
        ok('Driver', session.driver),
        { label: 'Secure cookies', value: session.secure ? 'true' : 'false', status: 'ok' },
      ],
    },
  ]

  return {
    generated_at: new Date().toISOString(),
    node_env: nodeEnv,
    version,
    sections,
  }
}
