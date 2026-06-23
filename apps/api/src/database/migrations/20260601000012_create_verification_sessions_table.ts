import { Migration, SchemaBuilder } from 'arkormx'

export default class CreateVerificationSessionsTableMigration extends Migration {
  public async up(schema: SchemaBuilder): Promise<void> {
    schema.createTable('verification_sessions', (table) => {
      table.id('id', 'uuid').primary()
      table
        .uuid('organizationId')
        .map('organization_id')
        .foreign()
        .references('organizations', 'id')
        .onDelete('cascade')
        .as('organization')
        .inverseAlias('sessions')
      table
        .uuid('projectId')
        .map('project_id')
        .foreign()
        .references('projects', 'id')
        .onDelete('cascade')
        .as('project')
        .inverseAlias('sessions')
      table.string('userReference').nullable().map('user_reference')
      table.string('status').index()
      table.string('autoDecision').nullable().map('auto_decision')
      table.string('finalDecision').nullable().map('final_decision')
      table.string('decisionReason').nullable().map('decision_reason')
      table.float('riskScore').nullable().map('risk_score')
      table.string('clientTokenHash').nullable().index().map('client_token_hash')
      table.timestamp('expiresAt').map('expires_at')
      table.timestamp('completedAt').nullable().map('completed_at')
      table.timestamp('reviewedAt').nullable().map('reviewed_at')
      table
        .uuid('reviewedBy')
        .nullable()
        .map('reviewed_by')
        .foreign()
        .references('users', 'id')
        .onDelete('setNull')
        .as('reviewer')
        .inverseAlias('reviewedSessions')
      table.json('metadata').nullable()
      table.timestamps('camel', 'snake')
      table.index(['organizationId'])
      table.index(['projectId', 'status'])
    })
  }

  public async down(schema: SchemaBuilder): Promise<void> {
    schema.dropTable('verification_sessions')
  }
}
