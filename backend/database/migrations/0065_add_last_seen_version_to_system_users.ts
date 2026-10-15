import { BaseSchema } from '@adonisjs/lucid/schema'

/** Última versión de novedades que el usuario ya cerró. */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('system_users', (table) => {
      table.string('last_seen_version', 32).nullable()
    })
  }

  async down() {
    this.schema.alterTable('system_users', (table) => {
      table.dropColumn('last_seen_version')
    })
  }
}
