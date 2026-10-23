import { Migration, SchemaBuilder } from 'arkormx'

/**
 * Client tokens for a verification session: the single-use `launch` token handed
 * to the integrator, single-use `handoff` tokens carried by the cross-device QR,
 * and the `device` tokens browsers use after claiming one of those.
 */
export default class CreateSessionClientTokensTableMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.createTable('session_client_tokens', (table) => {
      table.id('id', 'uuid').primary()
      table
        .uuid('sessionId')
        .map('session_id')
        .foreign()
        .references('verification_sessions', 'id')
        .onDelete('cascade')
      table.string('tokenHash').map('token_hash').unique()
      table.enum('kind', ['launch', 'handoff', 'device'])
      table.text('origin').nullable()
      table.timestamp('claimedAt').nullable().map('claimed_at')
      table.timestamp('expiresAt').map('expires_at')
      table.timestamps('camel', 'snake')
      table.index(['sessionId', 'kind'])
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.dropTable('session_client_tokens')
  }
}
