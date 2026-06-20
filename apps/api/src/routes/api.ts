import { Router } from '@arkstack/driver-express'

// Health check (served at /api).
Router.get('/', () => {
    return { status: 'OK' }
})

// Auto-load every other route file in this directory (grouped by concern),
// excluding this entrypoint and the web routes.
await Router.group('/', 'src/routes').when((e: string) => {
    return !e.includes('/api.') && !e.includes('/web.')
})
