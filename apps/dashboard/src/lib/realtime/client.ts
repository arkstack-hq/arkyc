import { createRealtime, type ModuleImporter, type RealtimeClient, type RealtimeConfig } from '@arkstack/realtime'

/**
 * The transport SDKs as literal imports, so Vite bundles them (as lazy chunks).
 * The library's default importer is non-literal and can't resolve a bare package
 * name in the browser.
 */
const SDKS: Record<string, () => Promise<unknown>> = {
  'pusher-js': () => import('pusher-js'),
  'firebase/app': () => import('firebase/app'),
  'firebase/auth': () => import('firebase/auth'),
  'firebase/database': () => import('firebase/database'),
  'firebase/messaging': () => import('firebase/messaging'),
}

export const importSdk: ModuleImporter = async (specifier) => {
  const load = SDKS[specifier]
  if (!load) throw new Error(`Unknown realtime SDK: ${specifier}`)

  return await load()
}

/** What `GET /v1/realtime/config` returns: the API's public realtime settings. */
export type RealtimeServerConfig = Omit<RealtimeConfig, 'transport' | 'event' | 'channelPrefix'> & {
  transport: NonNullable<RealtimeConfig['transport']>
  event: string
  channelPrefix: string
}

interface ClientOptions {
  /** The API base, e.g. `https://api.example.com/api`. */
  apiBase: string
  /** The dashboard bearer token, used to authorize private channels. */
  token: string | null
}

/**
 * Create a realtime client from the API's config, pointing channel
 * authorization at the dashboard authorizer with the user's bearer token.
 *
 * @param config
 * @param options
 * @returns
 */
export function createRealtimeClient(config: RealtimeServerConfig, options: ClientOptions): RealtimeClient {
  const authEndpoint = `${options.apiBase}/v1/realtime/auth`
  const auth = { headers: { Authorization: `Bearer ${options.token ?? ''}` } }

  return createRealtime({
    ...config,
    importModule: importSdk,
    pusher: config.pusher && {
      ...config.pusher,
      authEndpoint,
      auth,
    },
    'firebase-database': config['firebase-database'] && {
      ...config['firebase-database'],
      authEndpoint,
      auth,
    },
  })
}
