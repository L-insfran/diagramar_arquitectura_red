import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('diagram_links', (table) => {
      table.integer('code').nullable()
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        WITH numbered AS (
          SELECT id,
            ROW_NUMBER() OVER (
              PARTITION BY project_id
              ORDER BY created_at ASC, id ASC
            ) AS rn
          FROM diagram_links
        )
        UPDATE diagram_links
        SET code = numbered.rn
        FROM numbered
        WHERE diagram_links.id = numbered.id
      `)

      await db.rawQuery(`
        ALTER TABLE diagram_links ALTER COLUMN code SET NOT NULL
      `)

      await db.rawQuery(`
        CREATE UNIQUE INDEX diagram_links_project_code_active_uidx
        ON diagram_links (project_id, code)
        WHERE deleted_at IS NULL
      `)
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery(`DROP INDEX IF EXISTS diagram_links_project_code_active_uidx`)
    })

    this.schema.alterTable('diagram_links', (table) => {
      table.dropColumn('code')
    })
  }
}
