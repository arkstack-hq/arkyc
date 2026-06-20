import { queue } from '@app/services/Queue'
import { type OcrJobPayload, ocrJob } from './ocr'
import { type BiometricJobPayload, biometricJob } from './biometric'

/** Map of queue name → job handler. */
export const handlers: Record<string, (payload: never) => Promise<void>> = {
  ocr: ocrJob as (payload: never) => Promise<void>,
  biometric: biometricJob as (payload: never) => Promise<void>,
}

export type { OcrJobPayload, BiometricJobPayload }

/**
 * Claim and run the next job (optionally for a single queue). Returns `false`
 * when nothing was runnable. Handler failures are recorded on the job (retry or
 * dead-letter) rather than thrown.
 */
export async function processNext (queueName?: string): Promise<boolean> {
  const job = await queue.claim(queueName)
  if (!job) return false

  const handler = handlers[job.queue]
  try {
    if (!handler) throw new Error(`No handler registered for queue "${job.queue}"`)
    await handler(job.payload as never)
    await queue.complete(job)
  } catch (error) {
    await queue.fail(job, error)
  }

  return true
}

/**
 * Drain all currently-runnable jobs and return. Used by the worker's single
 * pass and by tests to process the pipeline synchronously. `max` bounds the loop
 * as a runaway guard.
 */
export async function drain (queueName?: string, max = 1000): Promise<void> {
  for (let i = 0; i < max; i++) {
    if (!(await processNext(queueName))) break
  }
}
