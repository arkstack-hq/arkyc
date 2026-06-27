import HealthController from 'src/app/http/controllers/HealthController'
import { Router } from '@arkstack/driver-express'
import { resolveRuntimeDir } from '@arkstack/common'
import { version } from '../../package.json'

Router.get('/health', [HealthController, 'api'])

Router.get('/', () => {
  return {
    version,
    name: `${config('app.name', 'Arkyc')} API`,
    description: `This is the base endpoint for ${config('app.name', 'Arkyc')} API v1. Please refer to the documentation for available endpoints and usage details.`,
    status: 'online',
  }
})

// Auto-load every other route file in this directory (grouped by concern),
// excluding this entrypoint and the web routes.
await Router.group('/', resolveRuntimeDir('src/routes')).when((e: string) => {
  const name = e.split(/[\\/]/).pop() ?? e

  return !name.startsWith('api.') && !name.startsWith('web.')
})
