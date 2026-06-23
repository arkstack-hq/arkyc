import { Migration, SchemaBuilder } from 'arkormx'

/**
 * Append-only audit trail for platform-admin actions (Phase 15). Separate from
 * the organization `audit_logs` because platform actions aren't organization-scoped. The
 * `actor_id` FK is `set null` on delete so history survives user removal.
 */
export default class CreatePlatformAuditLogsTableMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.createTable('platform_audit_logs', (table) => {
      table.id('id', 'uuid').primary()
      table
        .uuid('actorId')
        .nullable()
        .map('actor_id')
        .foreign()
        .references('users', 'id')
        .onDelete('setNull')
        .as('actor')
        .inverseAlias('platformAuditLogs')
      table.string('actorType').map('actor_type')
      table.string('action').index()
      table.string('entityType').map('entity_type')
      table.uuid('entityId').nullable().map('entity_id')
      table.json('metadata').nullable()
      table.string('ipAddress').nullable().map('ip_address')
      table.string('userAgent').nullable().map('user_agent')
      table.timestamps('camel', 'snake')
      table.index(['createdAt'])
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.dropTable('platform_audit_logs')
  }
}
