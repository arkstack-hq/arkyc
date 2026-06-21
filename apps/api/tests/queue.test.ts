import { describe, expect, it } from 'vitest'
import { Job } from '@arkstack/jobs'
import { app } from '../src/core/bootstrap'

// Touch the app import so config (incl. the queue connection) is loaded.
void app

/**
 * With the default `sync` connection (dev/tests), dispatching a job runs it
 * inline — which is what the verification pipeline relies on. The durable
 * `database`/`redis` connections + `ark queue:work` are exercised in
 * production; their correctness lives in `@arkstack/queue`.
 */
describe('queue (sync connection)', () => {
  it('runs a dispatched job inline', async () => {
    let ran = 0
    class PingJob extends Job {
      override queue = 'test'
      async handle(): Promise<void> {
        ran += 1
      }
    }

    await PingJob.dispatch()

    expect(ran).toBe(1)
  })

  it('runs jobs in dispatch order', async () => {
    const order: number[] = []
    class OrderJob extends Job {
      override queue = 'test'
      constructor(public n: number) {
        super()
      }
      async handle(): Promise<void> {
        order.push(this.n)
      }
    }

    await OrderJob.dispatch(1)
    await OrderJob.dispatch(2)

    expect(order).toEqual([1, 2])
  })
})
