import { RealtimeConfig } from '@arkyc/realtime'

export default (): RealtimeConfig => {
  return {
    /**
  `  * pusher` targets hosted Pusher Channels via `cluster`; setting `PUSHER_HOST`
     * opts into a self-hosted soketi instead (TLS defaults off for local soketi).

     *"pusher" | "firebase" | "polling" | "memory" | "off"
     */
    driver: 'off',

    pusher: {
      appId: env('PUSHER_APP_ID', 'arkyc'),
      key: env('PUSHER_APP_KEY', 'arkyc-key'),
      secret: env('PUSHER_APP_SECRET', 'arkyc-secret'),
      cluster: env('PUSHER_CLUSTER', 'mt1'),
      useTLS: env('PUSHER_USE_TLS', env('PUSHER_HOST', undefined) ? 'false' : 'true') === 'true',
      host: env('PUSHER_HOST', '') || undefined,
      port: Number(env('PUSHER_PORT', 6001)),
    },

    firebase: {
      projectId: env('FIREBASE_PROJECT_ID', ''),
      clientEmail: env('FIREBASE_CLIENT_EMAIL', ''),
      privateKey: env('FIREBASE_PRIVATE_KEY', '').replace(/\\n/g, '\n'),
      databaseURL: env('FIREBASE_DATABASE_URL', ''),
      apiKey: env('FIREBASE_API_KEY', ''),
      authDomain: env('FIREBASE_AUTH_DOMAIN', ''),
    },
  }
}
