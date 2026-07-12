import { auth } from '@arkstack/driver-express/middlewares'
import { Router } from '@arkstack/driver-express'
import { authLimiter, loginLimiter } from '@app/http/middlewares'
import RegisteredUserController from '@controllers/auth/RegisteredUserController'
import AuthenticatedUserController from '@controllers/auth/AuthenticatedUserController'
import InvitationController from '@controllers/auth/InvitationController'
import VerificationController from '@controllers/auth/VerificationController'
import NewPasswordController from '@controllers/auth/NewPasswordController'
import TwoFactorController from '@controllers/auth/TwoFactorController'

Router.group('/v1/auth', () => {
  Router.post('/register', [RegisteredUserController, 'create'], [authLimiter])
  Router.post('/login', [AuthenticatedUserController, 'create'], [loginLimiter])
  Router.post('/login/2fa', [AuthenticatedUserController, 'store'], [loginLimiter])
  Router.post('/login/2fa/resend', [AuthenticatedUserController, 'resend'], [loginLimiter])
  Router.get('/me', [AuthenticatedUserController, 'show'], [auth])
  Router.delete('/logout', [AuthenticatedUserController, 'destroy'], [auth])
  Router.post('/invitations/accept', [InvitationController, 'create'], [auth])

  // Two-factor enrollment (authenticated)
  Router.get('/2fa', [TwoFactorController, 'show'], [auth])
  Router.post('/2fa/setup', [TwoFactorController, 'setup'], [auth])
  Router.post('/2fa/confirm', [TwoFactorController, 'confirm'], [auth])
  Router.delete('/2fa', [TwoFactorController, 'destroy'], [auth])

  // Email verification (the POST re-sends a mail, so throttle before auth runs)
  Router.post('/verify', [VerificationController, 'create'], [authLimiter, auth])
  Router.put('/verify/:object', [VerificationController, 'update'], [auth])

  // Forgotten password
  Router.post('/forgot', [NewPasswordController, 'create'], [authLimiter])
  Router.get('/forgot/:token', [NewPasswordController, 'show'], [authLimiter])
  Router.put('/forgot/:token', [NewPasswordController, 'update'], [authLimiter])

  // Change password (authenticated)
  Router.put('/password', [NewPasswordController, 'change'], [auth])
})

export default () => {}
