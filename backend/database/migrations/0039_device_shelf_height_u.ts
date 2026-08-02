import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Altura vertical (U) de un equipo apoyado en bandeja.
 * Anclado en la U base de la bandeja y crece hacia arriba (ADR 0006 addendum).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('devices', (table) => {
      table.integer('shelf_height_u').nullable()
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        ALTER TABLE devices
        ADD CONSTRAINT devices_shelf_height_u_check
        CHECK (shelf_height_u IS NULL OR (shelf_height_u BETWEEN 1 AND 20))
      `)
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery(
        `ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_shelf_height_u_check`
      )
    })

    this.schema.alterTable('devices', (table) => {
      table.dropColumn('shelf_height_u')
    })
  }
}
