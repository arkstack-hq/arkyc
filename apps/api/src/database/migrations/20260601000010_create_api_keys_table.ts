import { Migration, SchemaBuilder } from 'arkormx'

export default class CreateApiKeysTableMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.createTable('api_keys', (table) => {
      table.id('id', 'uuid').primary()
      table
        .uuid('organizationId')
        .map('organization_id')
        .foreign()
        .references('organizations', 'id')
        .onDelete('cascade')
        .as('organization')
        .inverseAlias('apiKeys')
      table
        .uuid('projectId')
        .map('project_id')
        .foreign()
        .references('projects', 'id')
        .onDelete('cascade')
        .as('project')
        .inverseAlias('apiKeys')
      table.string('name')
      table.string('keyPrefix').index().map('key_prefix')
      table.string('keyHash').unique().map('key_hash')
      table.timestamp('lastUsedAt').nullable().map('last_used_at')
      table.timestamp('expiresAt').nullable().map('expires_at')
      table.timestamp('revokedAt').nullable().map('revoked_at')
      table.timestamps('camel', 'snake')
      table.index(['projectId'])
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.dropTable('api_keys')
  }
}
