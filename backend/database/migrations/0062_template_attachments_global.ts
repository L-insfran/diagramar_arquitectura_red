import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Adjuntos de device_template son catálogo global: project_id nulo.
 * El resto de adjuntos sigue siendo del proyecto.
 */
export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      await db.rawQuery(`ALTER TABLE attachments ALTER COLUMN project_id DROP NOT NULL`)
      await db.rawQuery(`
        UPDATE attachments
        SET project_id = NULL
        WHERE attachable_type = 'device_template'
      `)
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery(`DELETE FROM attachments WHERE project_id IS NULL`)
      await db.rawQuery(`ALTER TABLE attachments ALTER COLUMN project_id SET NOT NULL`)
    })
  }
}
