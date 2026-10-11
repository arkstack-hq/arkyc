import { Migration, SchemaBuilder } from 'arkormx'

/** The address and browser that claimed a client token, for device and velocity signals. */
export default class AddNetworkToSessionClientTokensMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.alterTable('session_client_tokens', (table) => {
      table.string('ipAddress').nullable().map('ip_address')
      table.text('userAgent').nullable().map('user_agent')
      table.index(['ipAddress', 'created_at'])
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.alterTable('session_client_tokens', (table) => {
      table.dropColumn('ip_address')
      table.dropColumn('user_agent')
    })
  }
}
