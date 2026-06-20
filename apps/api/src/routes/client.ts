import { Router } from '@arkstack/driver-express'
import { clientTokenAuth } from '@app/http/middlewares'
import ClientSessionController from '@controllers/client/ClientSessionController'

// Client/Widget API (short-lived client token). Drives one session through
// document capture, liveness, and completion.
Router.group('/v1/client', () => {
    Router.get('/session', [ClientSessionController, 'session'], [clientTokenAuth])
    Router.post('/document/front', [ClientSessionController, 'documentFront'], [clientTokenAuth])
    Router.post('/document/back', [ClientSessionController, 'documentBack'], [clientTokenAuth])
    Router.post('/liveness', [ClientSessionController, 'liveness'], [clientTokenAuth])
    Router.post('/complete', [ClientSessionController, 'complete'], [clientTokenAuth])
})

export default () => {}
