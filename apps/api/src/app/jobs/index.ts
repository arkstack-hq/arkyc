import { JobRegistry } from '@arkstack/jobs'
import { OcrJob } from './OcrJob'
import { BiometricJob } from './BiometricJob'
import { WebhookJob } from './WebhookJob'
import { WebhookResendJob } from './WebhookResendJob'
import { SessionSweepJob } from './SessionSweepJob'
import { UserNotificationJob } from './UserNotificationJob'
import { DeletionJob } from './DeletionJob'

// Register the job classes so dedicated worker processes (which reconstruct
// jobs from a stored payload, bypassing the constructor) can resolve them by
// name. Importing this module once — e.g. from the app bootstrap and the
// `queue:work` command — is enough.
JobRegistry.register(OcrJob)
JobRegistry.register(BiometricJob)
JobRegistry.register(WebhookJob)
JobRegistry.register(WebhookResendJob)
JobRegistry.register(SessionSweepJob)
JobRegistry.register(UserNotificationJob)
JobRegistry.register(DeletionJob)

export { OcrJob, BiometricJob, WebhookJob, WebhookResendJob, SessionSweepJob, UserNotificationJob, DeletionJob }
export type { OcrJobHints } from './OcrJob'
export type { BiometricJobHints } from './BiometricJob'
