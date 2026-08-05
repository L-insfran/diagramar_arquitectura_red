import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Branding global del sistema (logo + tagline para reportes PDF).
 * Storage: disco local (`storage/system/`) — mismo espíritu que ADR 0003.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('system_settings', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.string('report_tagline', 255).nullable()
      table.string('logo_storage_path', 500).nullable()
      table.string('logo_mime_type', 120).nullable()
      table.string('logo_original_filename', 255).nullable()
      table.bigInteger('logo_size_bytes').nullable()
      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable('system_settings')
  }
}
