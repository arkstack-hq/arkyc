import { auth } from '@arkstack/driver-express/middlewares'
import { Router } from '@arkstack/driver-express'
import RealtimeController from '@controllers/realtime/RealtimeController'

// Realtime client glue (Phase 16). Both require `auth`; channel access is then
// authorized per-channel against the caller's tenant/project/session scope.
Router.group('/v1/realtime', () => {
  Router.post('/auth', [RealtimeController, 'auth'], [auth])
  Router.get('/config', [RealtimeController, 'config'], [auth])
})

export default () => {}
