import { Migration, SchemaBuilder } from 'arkormx'

/** Wrong guesses made against a password reset code. */
export default class AddAttemptsToPasswordResetsMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.alterTable('password_resets', (table) => {
      table.integer('attempts').default(0)
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.alterTable('password_resets', (table) => {
      table.dropColumn('attempts')
    })
  }
}
