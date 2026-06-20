import { describe, expect, it } from 'vitest'
import { app } from '../src/core/bootstrap'
import { queue } from '../src/app/services/Queue'
import { Job } from '../src/app/models/Job'

// Touch the app import so the DB/runtime boots before the models are used.
void app

// Unique queue per run so leftover rows from prior runs never interfere.
const Q = `test-${Date.now()}`

describe('queue (pg-backed)', () => {
  it('claims a job atomically, then completes it', async () => {
    const job = await queue.enqueue(Q, { hello: 'world' })
    const claimed = await queue.claim(Q)

    expect(claimed?.id).toBe(job.id)
    expect(claimed!.status).toBe('reserved')
    expect(claimed!.attempts).toBe(1)

    await queue.complete(claimed!)
    const after = await Job.where({ id: job.id }).firstOrFail()
    expect(after.status).toBe('completed')
  })

  it('returns null when nothing is runnable', async () => {
    expect(await queue.claim(`${Q}-empty`)).toBeNull()
  })

  it('does not claim a job whose delay has not elapsed', async () => {
    await queue.enqueue(`${Q}-delayed`, {}, { delayMs: 60_000 })
    expect(await queue.claim(`${Q}-delayed`)).toBeNull()
  })

  it('reschedules a failed job with backoff while attempts remain', async () => {
    const job = await queue.enqueue(`${Q}-retry`, {}, { maxAttempts: 3 })
    const claimed = await queue.claim(`${Q}-retry`)
    await queue.fail(claimed!, new Error('transient'))

    const retried = await Job.where({ id: job.id }).firstOrFail()
    expect(retried.status).toBe('pending')
    expect(retried.attempts).toBe(1)
    expect(retried.lastError).toContain('transient')
    expect(new Date(retried.availableAt).getTime()).toBeGreaterThan(Date.now())
  })

  it('dead-letters a job once attempts are exhausted', async () => {
    const job = await queue.enqueue(`${Q}-dead`, {}, { maxAttempts: 1 })
    const claimed = await queue.claim(`${Q}-dead`)
    expect(claimed!.attempts).toBe(1)
    await queue.fail(claimed!, new Error('boom'))

    const dead = await Job.where({ id: job.id }).firstOrFail()
    expect(dead.status).toBe('dead')
    expect(dead.lastError).toContain('boom')
  })
})
