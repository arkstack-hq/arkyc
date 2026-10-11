import { Router } from '@arkstack/driver-express'
import { clientTokenAuth } from '@app/http/middlewares'
import ClientSessionController from '@controllers/client/ClientSessionController'
import ClientTokenController from '@controllers/client/ClientTokenController'

// Client/Widget API (device client token). Drives one session through
// document capture, liveness, and completion.
Router.group('/v1/client', () => {
  // Exchange the single-use launch or handoff token for this browser's device token.
  Router.post('/claim', [ClientTokenController, 'claim'])
  // A single-use token for the cross-device QR code.
  Router.post('/handoff', [ClientTokenController, 'handoff'], [clientTokenAuth])
  Router.get('/session', [ClientSessionController, 'session'], [clientTokenAuth])
  Router.post('/document/front', [ClientSessionController, 'documentFront'], [clientTokenAuth])
  Router.post('/document/back', [ClientSessionController, 'documentBack'], [clientTokenAuth])
  Router.post('/liveness', [ClientSessionController, 'liveness'], [clientTokenAuth])
  // Opt-in address-verification stage (custom workflows only).
  Router.post('/address', [ClientSessionController, 'address'], [clientTokenAuth])
  Router.post('/complete', [ClientSessionController, 'complete'], [clientTokenAuth])
  // Pusher channel-auth scoped to this session's own channel (widget realtime).
  Router.post('/realtime/auth', [ClientSessionController, 'realtimeAuth'], [clientTokenAuth])
})

export default () => {}
