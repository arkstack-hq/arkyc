import { DB, Migration, SchemaBuilder } from 'arkormx'

/**
 * Face embeddings for duplicate-face search, stored with pgvector. Only written
 * for organizations that opt in. The column has no fixed dimension because it
 * depends on the model, so searches always filter by `model`.
 */
export default class CreateFaceEmbeddingsTableMigration extends Migration {
  public async up(_schema: SchemaBuilder): Promise<void> {
    await DB.raw('create extension if not exists vector')
    await DB.raw(`
      create table if not exists face_embeddings (
        id uuid primary key default gen_random_uuid(),
        organization_id uuid not null references organizations(id) on delete cascade,
        project_id uuid not null references projects(id) on delete cascade,
        session_id uuid not null references verification_sessions(id) on delete cascade,
        user_reference varchar(255),
        model varchar(255) not null,
        embedding vector not null,
        expires_at timestamp(3) not null,
        created_at timestamp(3) not null default now(),
        updated_at timestamp(3) not null default now()
      )
    `)
    await DB.raw('create unique index if not exists face_embeddings_session_id_unique on face_embeddings (session_id)')
    await DB.raw(
      'create index if not exists face_embeddings_org_model_index on face_embeddings (organization_id, model)',
    )
    await DB.raw('create index if not exists face_embeddings_expires_at_index on face_embeddings (expires_at)')
  }

  public async down(_schema: SchemaBuilder): Promise<void> {
    await DB.raw('drop table if exists face_embeddings')
  }
}
