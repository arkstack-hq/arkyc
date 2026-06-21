import { Migration, SchemaBuilder } from 'arkormx'

/**
 * Durable, Postgres-backed job queue (Phase 8). Workers claim rows atomically
 * with `FOR UPDATE SKIP LOCKED`; `available_at` drives delays + retry backoff,
 * and a visibility timeout on `reserved_at` reclaims jobs from crashed workers.
 */
export default class CreateJobsTableMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.createTable('jobs', (table) => {
      table.id('id', 'uuid').primary()
      table.string('queue')
      table.json('payload').nullable()
      table.string('status')
      table.integer('attempts')
      table.integer('maxAttempts').map('max_attempts')
      table.timestamp('availableAt').map('available_at')
      table.timestamp('reservedAt').nullable().map('reserved_at')
      table.text('lastError').nullable().map('last_error')
      table.timestamps('camel', 'snake')

      // Hot path: claim the next runnable job on a queue.
      table.index(['queue', 'status', 'availableAt'])
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.dropTable('jobs')
  }
}
