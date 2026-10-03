import { BaseSchema } from '@adonisjs/lucid/schema'

const PARTIAL_INDEXES = [
  'devices_project_active_idx',
  'connections_project_active_idx',
  'containers_project_active_idx',
  'diagram_links_project_active_idx',
  'sites_project_active_idx',
  'attachments_project_active_idx',
] as const

const TRGM_INDEXES = [
  'devices_name_trgm_active_idx',
  'devices_hostname_trgm_active_idx',
  'devices_ip_address_trgm_active_idx',
] as const

export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      await db.rawQuery(`
        CREATE INDEX IF NOT EXISTS devices_project_active_idx
          ON devices (project_id) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS connections_project_active_idx
          ON connections (project_id) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS containers_project_active_idx
          ON containers (project_id) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS diagram_links_project_active_idx
          ON diagram_links (project_id) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS sites_project_active_idx
          ON sites (project_id) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS attachments_project_active_idx
          ON attachments (project_id) WHERE deleted_at IS NULL;
      `)

      await db.rawQuery(`
        DO $$
        BEGIN
          CREATE EXTENSION IF NOT EXISTS pg_trgm;
        EXCEPTION
          WHEN OTHERS THEN
            RAISE NOTICE 'pg_trgm skipped: %', SQLERRM;
        END $$;
      `)

      await db.rawQuery(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
            EXECUTE 'CREATE INDEX IF NOT EXISTS devices_name_trgm_active_idx ON devices USING gin (name gin_trgm_ops) WHERE deleted_at IS NULL';
            EXECUTE 'CREATE INDEX IF NOT EXISTS devices_hostname_trgm_active_idx ON devices USING gin (hostname gin_trgm_ops) WHERE deleted_at IS NULL';
            EXECUTE 'CREATE INDEX IF NOT EXISTS devices_ip_address_trgm_active_idx ON devices USING gin (ip_address gin_trgm_ops) WHERE deleted_at IS NULL';
          END IF;
        END $$;
      `)
    })
  }

  async down() {
    this.defer(async (db) => {
      const names = [...PARTIAL_INDEXES, ...TRGM_INDEXES]
      await db.rawQuery(names.map((name) => `DROP INDEX IF EXISTS ${name}`).join(';\n'))
    })
  }
}
