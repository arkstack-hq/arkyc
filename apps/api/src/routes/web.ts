import HealthController from 'src/app/http/controllers/HealthController'
import { Router } from '@arkstack/driver-express'
import { view } from '@arkstack/view'

Router.get('/health', [HealthController, 'web'])

Router.get('/', () => {
  return view('welcome', {
    version: 'v1',
    appName: config('app.name', 'Arkyc'),
  })
})
