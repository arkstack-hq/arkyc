import { auth } from '@arkstack/driver-express/middlewares'
import { Router } from '@arkstack/driver-express'
import RegisteredUserController from '@controllers/auth/RegisteredUserController'
import AuthenticatedUserController from '@controllers/auth/AuthenticatedUserController'
import InvitationController from '@controllers/auth/InvitationController'
import VerificationController from '@controllers/auth/VerificationController'
import NewPasswordController from '@controllers/auth/NewPasswordController'
import TwoFactorController from '@controllers/auth/TwoFactorController'

Router.group('/v1/auth', () => {
  Router.post('/register', [RegisteredUserController, 'create'])
  Router.post('/login', [AuthenticatedUserController, 'create'])
  Router.post('/login/2fa', [AuthenticatedUserController, 'store'])
  Router.post('/login/2fa/resend', [AuthenticatedUserController, 'resend'])
  Router.get('/me', [AuthenticatedUserController, 'show'], [auth])
  Router.delete('/logout', [AuthenticatedUserController, 'destroy'], [auth])
  Router.post('/invitations/accept', [InvitationController, 'create'], [auth])

  // Two-factor enrollment (authenticated)
  Router.get('/2fa', [TwoFactorController, 'show'], [auth])
  Router.post('/2fa/setup', [TwoFactorController, 'setup'], [auth])
  Router.post('/2fa/confirm', [TwoFactorController, 'confirm'], [auth])
  Router.delete('/2fa', [TwoFactorController, 'destroy'], [auth])

  // Email verification
  Router.post('/verify', [VerificationController, 'create'], [auth])
  Router.put('/verify/:object', [VerificationController, 'update'], [auth])

  // Forgotten password
  Router.post('/forgot', [NewPasswordController, 'create'])
  Router.get('/forgot/:token', [NewPasswordController, 'show'])
  Router.put('/forgot/:token', [NewPasswordController, 'update'])

  // Change password (authenticated)
  Router.put('/password', [NewPasswordController, 'change'], [auth])
})

export default () => {}
