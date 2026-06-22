import type { FirebaseConfig, RealtimeDriver } from '../types'

/** The slice of `firebase-admin` we use. */
interface AdminApp {
  database(): { ref(path: string): { push(value: unknown): Promise<unknown> } }
  auth(): { createCustomToken(uid: string, claims?: Record<string, unknown>): Promise<string> }
}
interface AdminModule {
  default: {
    apps: Array<{ name: string } | null>
    app(name: string): AdminApp
    initializeApp(options: Record<string, unknown>, name: string): AdminApp
    credential: { cert(serviceAccount: Record<string, unknown>): unknown }
  }
}

const APP_NAME = 'arkyc-realtime'

/**
 * Firebase driver — broadcasts by pushing event records to the Realtime Database
 * (clients listen via `onChildAdded`) and mints per-user custom tokens carrying
 * tenant claims (the browser signs in with `signInWithCustomToken`; RDB security
 * rules authorize reads by claim). `firebase-admin` is dynamically imported so it
 * only loads when firebase is the active transport.
 */
export class FirebaseRealtimeDriver implements RealtimeDriver {
  readonly name = 'firebase' as const

  private app: AdminApp | null = null

  constructor(private readonly config: FirebaseConfig) {}

  private async admin(): Promise<AdminApp> {
    if (this.app) return this.app
    const mod = (await import('firebase-admin')) as unknown as AdminModule
    const admin = mod.default
    const existing = admin.apps.find((a) => a?.name === APP_NAME)
    this.app = existing
      ? admin.app(APP_NAME)
      : admin.initializeApp(
          {
            credential: admin.credential.cert({
              projectId: this.config.projectId,
              clientEmail: this.config.clientEmail,
              privateKey: this.config.privateKey,
            }),
            databaseURL: this.config.databaseURL,
          },
          APP_NAME,
        )
    return this.app
  }

  async publish(channels: readonly string[], event: string, payload: unknown): Promise<void> {
    if (channels.length === 0) return
    const app = await this.admin()
    const db = app.database()
    await Promise.all(channels.map((channel) => db.ref(`realtime/${channel}`).push({ event, payload, at: Date.now() })))
  }

  clientConfig(): Record<string, unknown> {
    return {
      apiKey: this.config.apiKey,
      authDomain: this.config.authDomain,
      projectId: this.config.projectId,
      databaseURL: this.config.databaseURL,
    }
  }

  async mintClientToken(uid: string, claims: Record<string, unknown>): Promise<string | null> {
    const app = await this.admin()
    return app.auth().createCustomToken(uid, claims)
  }
}
