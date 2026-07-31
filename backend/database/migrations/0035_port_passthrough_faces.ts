import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Patch panels / passthrough: un jack = dos caras (front/rear).
 * Unicidad física pasa de "1 por puerto" a "1 por (puerto, cara)".
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('ports', (table) => {
      table.boolean('is_passthrough').notNullable().defaultTo(false)
    })

    this.schema.alterTable('device_template_ports', (table) => {
      table.boolean('is_passthrough').notNullable().defaultTo(false)
    })

    this.schema.alterTable('connections', (table) => {
      table.string('source_face', 10).nullable()
      table.string('target_face', 10).nullable()
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        ALTER TABLE connections
        DROP CONSTRAINT IF EXISTS connections_source_face_check
      `)
      await db.rawQuery(`
        ALTER TABLE connections
        ADD CONSTRAINT connections_source_face_check
        CHECK (source_face IS NULL OR source_face IN ('front', 'rear'))
      `)
      await db.rawQuery(`
        ALTER TABLE connections
        DROP CONSTRAINT IF EXISTS connections_target_face_check
      `)
      await db.rawQuery(`
        ALTER TABLE connections
        ADD CONSTRAINT connections_target_face_check
        CHECK (target_face IS NULL OR target_face IN ('front', 'rear'))
      `)

      // Existing links occupy the front face of each endpoint.
      await db.from('connections').whereNull('source_face').update({ source_face: 'front' })
      await db.from('connections').whereNull('target_face').update({ target_face: 'front' })

      await db.rawQuery(`
        ALTER TABLE connections
        ALTER COLUMN source_face SET DEFAULT 'front',
        ALTER COLUMN source_face SET NOT NULL
      `)
      await db.rawQuery(`
        ALTER TABLE connections
        ALTER COLUMN target_face SET DEFAULT 'front',
        ALTER COLUMN target_face SET NOT NULL
      `)

      // Structured cabling devices: mark ports as passthrough.
      await db.rawQuery(`
        UPDATE ports
        SET is_passthrough = true
        WHERE device_id IN (
          SELECT d.id
          FROM devices d
          INNER JOIN device_types dt ON dt.id = d.device_type_id
          WHERE LOWER(dt.name) LIKE '%patch%'
             OR LOWER(dt.name) LIKE '%cableado estructurado%'
        )
      `)

      await db.rawQuery(`
        UPDATE device_template_ports
        SET is_passthrough = true
        WHERE device_template_id IN (
          SELECT t.id
          FROM device_templates t
          INNER JOIN device_types dt ON dt.id = t.device_type_id
          WHERE t.deleted_at IS NULL
            AND (
              LOWER(dt.name) LIKE '%patch%'
              OR LOWER(dt.name) LIKE '%cableado estructurado%'
            )
        )
      `)

      await db.rawQuery(`DROP INDEX IF EXISTS connections_source_port_active_uidx`)
      await db.rawQuery(`DROP INDEX IF EXISTS connections_target_port_active_uidx`)

      await db.rawQuery(`
        CREATE UNIQUE INDEX IF NOT EXISTS connections_source_port_face_active_uidx
        ON connections (source_port_id, source_face)
        WHERE deleted_at IS NULL AND connection_type = 'physical'
      `)
      await db.rawQuery(`
        CREATE UNIQUE INDEX IF NOT EXISTS connections_target_port_face_active_uidx
        ON connections (target_port_id, target_face)
        WHERE deleted_at IS NULL AND connection_type = 'physical'
      `)
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery(`DROP INDEX IF EXISTS connections_source_port_face_active_uidx`)
      await db.rawQuery(`DROP INDEX IF EXISTS connections_target_port_face_active_uidx`)

      await db.rawQuery(`
        CREATE UNIQUE INDEX IF NOT EXISTS connections_source_port_active_uidx
        ON connections (source_port_id)
        WHERE deleted_at IS NULL AND connection_type = 'physical'
      `)
      await db.rawQuery(`
        CREATE UNIQUE INDEX IF NOT EXISTS connections_target_port_active_uidx
        ON connections (target_port_id)
        WHERE deleted_at IS NULL AND connection_type = 'physical'
      `)

      await db.rawQuery(`
        ALTER TABLE connections DROP CONSTRAINT IF EXISTS connections_source_face_check
      `)
      await db.rawQuery(`
        ALTER TABLE connections DROP CONSTRAINT IF EXISTS connections_target_face_check
      `)
    })

    this.schema.alterTable('connections', (table) => {
      table.dropColumn('source_face')
      table.dropColumn('target_face')
    })

    this.schema.alterTable('ports', (table) => {
      table.dropColumn('is_passthrough')
    })

    this.schema.alterTable('device_template_ports', (table) => {
      table.dropColumn('is_passthrough')
    })
  }
}
