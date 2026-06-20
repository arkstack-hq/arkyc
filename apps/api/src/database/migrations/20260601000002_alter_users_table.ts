import { Migration, SchemaBuilder } from 'arkormx'

/**
 * Extend the base `users` table (created by @arkstack/auth) with the
 * Arkyc-specific profile columns. The auth framework owns `password`, so we
 * keep that column name rather than the spec's `password_hash`.
 */
export default class AlterUsersTableMigration extends Migration {
    public async up (schema: SchemaBuilder): Promise<void> {
        schema.alterTable('users', (table) => {
            table.string('avatarUrl').nullable().map('avatar_url')
            table.date('lastLoginAt').nullable().map('last_login_at')
        })
    }

    public async down (schema: SchemaBuilder): Promise<void> {
        schema.alterTable('users', (table) => {
            table.dropColumn('avatar_url')
            table.dropColumn('last_login_at')
        })
    }
}
