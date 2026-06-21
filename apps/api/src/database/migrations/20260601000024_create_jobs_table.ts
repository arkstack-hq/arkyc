import { Migration, SchemaBuilder } from 'arkormx'

/**
 * Jobs table for `@arkstack/queue`'s `database` driver.
 *
 * The driver inserts/claims rows directly (no model), so the columns and their
 * names must match what it expects: an auto-increment `id`, `queue`, `payload`
 * (JSON text), `attempts`, and the epoch-second timestamps `reserved_at` /
 * `available_at` / `created_at`. Reservation stamps `reserved_at` and bumps
 * `attempts`; completion deletes the row; release clears `reserved_at` and
 * pushes `available_at` out by the job's backoff.
 *
 * Only needed for the `database` connection — dev/tests use `sync` (inline).
 */
export default class CreateJobsTableMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.createTable('jobs', (table) => {
      table.id('id') // auto-increment primary key (DB-generated)
      table.string('queue')
      table.text('payload')
      table.integer('attempts')
      table.integer('reserved_at').nullable()
      table.integer('available_at')
      table.integer('created_at').nullable()

      // Hot path: claim the next runnable job on a queue.
      table.index(['queue', 'available_at'])
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.dropTable('jobs')
  }
}
