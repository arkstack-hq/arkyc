import { QueueConfig } from '@arkstack/queue'
import { env } from '@arkstack/common'

export interface AppQueueConfig extends QueueConfig {
  /**
   * The queue each kind of job is dispatched onto. Every name is overridable, so a
   * deployment that runs a worker per queue (docker-compose) keeps them separate,
   * while a resource-limited one can point them all at a single queue (e.g.
   * `default`) and run one `ark queue:work`.
   */
  queues: {
    ocr: string
    biometric: string
    webhook: string
    maintenance: string
    notifications: string
  }
}

export default (): AppQueueConfig => {
  return {
    /**
     * Default Queue Connection
     *
     * The connection used when a job is dispatched without specifying one.
     * The `sync` connection runs jobs immediately (no worker required) and is
     * a sensible default for local development and tests.
     *
     * Supported drivers: sync, database, redis.
     */
    default: env('QUEUE_CONNECTION', 'sync'),

    /**
     * Queue Connections
     *
     * Configure a connection per backend. Run a worker with `ark queue:work`
     * to process jobs on the database and redis connections.
     */
    connections: {
      sync: {
        driver: 'sync',
      },
      database: {
        driver: 'database',
        table: env('QUEUE_TABLE', 'jobs'),
        queue: env('QUEUE_NAME', 'default'),
        retryAfter: env('QUEUE_RETRY_AFTER', 90),
      },
      redis: {
        driver: 'redis',
        host: env('REDIS_HOST', '127.0.0.1'),
        port: env('REDIS_PORT', 6379),
        password: env('REDIS_PASSWORD'),
        db: env('REDIS_QUEUE_DB', 2),
        queue: env('QUEUE_NAME', 'default'),
        retryAfter: env('QUEUE_RETRY_AFTER', 90),
      },
    },

    /**
     * Job Queues
     *
     * The queue each kind of job is dispatched onto. A deployment running a worker
     * per queue (docker-compose) keeps them separate; a resource-limited one can
     * point them all at `default` and run a single `ark queue:work`.
     */
    queues: {
      ocr: env('QUEUE_NAME_OCR', 'ocr'),
      biometric: env('QUEUE_NAME_BIOMETRIC', 'biometric'),
      webhook: env('QUEUE_NAME_WEBHOOK', 'webhook'),
      maintenance: env('QUEUE_NAME_MAINTENANCE', 'maintenance'),
      notifications: env('QUEUE_NAME_NOTIFICATIONS', 'notifications'),
    },
  }
}
