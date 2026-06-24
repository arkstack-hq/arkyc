import HealthController from 'src/app/http/controllers/HealthController'
import { Router } from '@arkstack/driver-express'
import { version } from '../../package.json'

Router.get('/health', [HealthController, 'api'])

Router.get('/', () => {
  return {
    version,
    name: `${env('APP_NAME', 'Arkyc')} API`,
    description: `This is the base endpoint for ${env('APP_NAME', 'Arkyc')} API v1. Please refer to the documentation for available endpoints and usage details.`,
    status: 'online',
  }
})

// Auto-load every other route file in this directory (grouped by concern),
// excluding this entrypoint and the web routes.
await Router.group('/', 'src/routes').when((e: string) => {
  return !e.includes('/api.') && !e.includes('/web.')
})
