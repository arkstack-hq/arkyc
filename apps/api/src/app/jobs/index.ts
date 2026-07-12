import { JobRegistry } from '@arkstack/jobs'
import { OcrJob } from './OcrJob'
import { BiometricJob } from './BiometricJob'
import { WebhookJob } from './WebhookJob'
import { SessionSweepJob } from './SessionSweepJob'

// Register the job classes so dedicated worker processes (which reconstruct
// jobs from a stored payload, bypassing the constructor) can resolve them by
// name. Importing this module once — e.g. from the app bootstrap and the
// `queue:work` command — is enough.
JobRegistry.register(OcrJob)
JobRegistry.register(BiometricJob)
JobRegistry.register(WebhookJob)
JobRegistry.register(SessionSweepJob)

export { OcrJob, BiometricJob, WebhookJob, SessionSweepJob }
export type { OcrJobHints } from './OcrJob'
export type { BiometricJobHints } from './BiometricJob'
