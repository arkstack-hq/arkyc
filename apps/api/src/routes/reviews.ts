import { auth } from '@arkstack/driver-express/middlewares'
import { Router } from '@arkstack/driver-express'
import type { PermissionKey } from '@arkyc/types'
import { can, resolveTenant } from '@app/http/middlewares'
import SessionReviewController from '@controllers/dashboard/SessionReviewController'
import AuditLogController from '@controllers/dashboard/AuditLogController'

const scoped = (perm: PermissionKey) => [auth, resolveTenant, can(perm)]

// Dashboard review queue + reviewer actions, and the audit-log read API.
Router.group('/v1/dashboard/tenants/:tenantId', () => {
  Router.get('/sessions', [SessionReviewController, 'index'], scoped('sessions.view'))
  Router.get('/sessions/:id', [SessionReviewController, 'show'], scoped('sessions.view'))
  Router.get('/sessions/:id/media/:kind', [SessionReviewController, 'media'], scoped('sessions.view'))
  Router.post('/sessions/:id/approve', [SessionReviewController, 'approve'], scoped('reviews.approve'))
  Router.post('/sessions/:id/reject', [SessionReviewController, 'reject'], scoped('reviews.reject'))
  Router.post('/sessions/:id/request-retry', [SessionReviewController, 'requestRetry'], scoped('reviews.request_retry'))
  Router.post('/sessions/:id/assign', [SessionReviewController, 'assign'], scoped('reviews.assign'))
  Router.post('/sessions/:id/suspicious', [SessionReviewController, 'markSuspicious'], scoped('reviews.note'))
  Router.post('/sessions/:id/notes', [SessionReviewController, 'note'], scoped('reviews.note'))

  Router.get('/audit-logs', [AuditLogController, 'index'], scoped('audit_logs.view'))
})

export default () => {}
