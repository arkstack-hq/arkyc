import { auth } from '@arkstack/driver-express/middlewares'
import { Router } from '@arkstack/driver-express'
import NotificationController from '@controllers/account/NotificationController'
import NotificationPreferenceController from '@controllers/account/NotificationPreferenceController'
import PushTokenController from '@controllers/account/PushTokenController'
import InvitationController from '@controllers/account/InvitationController'

// The signed-in user's notifications, delivery preferences, push devices and invitations.
Router.group('/v1/account', () => {
  Router.get('/notifications', [NotificationController, 'index'], [auth])
  Router.patch('/notifications/read', [NotificationController, 'readAll'], [auth])
  Router.patch('/notifications/:id/read', [NotificationController, 'read'], [auth])
  Router.delete('/notifications/:id', [NotificationController, 'destroy'], [auth])

  Router.get('/notification-preferences', [NotificationPreferenceController, 'show'], [auth])
  Router.patch('/notification-preferences', [NotificationPreferenceController, 'update'], [auth])

  Router.get('/invitations', [InvitationController, 'index'], [auth])
  Router.patch('/invitations/:id/accept', [InvitationController, 'accept'], [auth])

  Router.post('/push-tokens', [PushTokenController, 'create'], [auth])
  Router.delete('/push-tokens', [PushTokenController, 'destroy'], [auth])
})

export default () => {}
