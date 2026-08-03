import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Full-depth templates occupy the same U on front + rear.
 * chassis_face assigns non-passthrough ports to a physical chassis side (ADR 0007).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('device_templates', (table) => {
      table.boolean('is_full_depth').notNullable().defaultTo(false)
    })

    this.schema.alterTable('device_template_ports', (table) => {
      table.string('chassis_face', 10).notNullable().defaultTo('front')
    })

    this.schema.alterTable('ports', (table) => {
      table.string('chassis_face', 10).notNullable().defaultTo('front')
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_rack_face_check
      `)
      await db.rawQuery(`
        ALTER TABLE devices
        ADD CONSTRAINT devices_rack_face_check
        CHECK (rack_face IS NULL OR rack_face IN ('front', 'rear', 'both'))
      `)

      await db.rawQuery(`
        ALTER TABLE device_template_ports
        ADD CONSTRAINT device_template_ports_chassis_face_check
        CHECK (chassis_face IN ('front', 'rear'))
      `)
      await db.rawQuery(`
        ALTER TABLE ports
        ADD CONSTRAINT ports_chassis_face_check
        CHECK (chassis_face IN ('front', 'rear'))
      `)

      await db.rawQuery(`
        UPDATE device_templates AS dt
        SET is_full_depth = true
        FROM device_types AS dty
        WHERE dty.id = dt.device_type_id
          AND LOWER(dty.name) LIKE '%server%'
          AND dt.deleted_at IS NULL
      `)
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery(
        `UPDATE devices SET rack_face = 'front' WHERE rack_face = 'both'`
      )
      await db.rawQuery(`ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_rack_face_check`)
      await db.rawQuery(`
        ALTER TABLE devices
        ADD CONSTRAINT devices_rack_face_check
        CHECK (rack_face IS NULL OR rack_face IN ('front', 'rear'))
      `)
      await db.rawQuery(
        `ALTER TABLE device_template_ports DROP CONSTRAINT IF EXISTS device_template_ports_chassis_face_check`
      )
      await db.rawQuery(
        `ALTER TABLE ports DROP CONSTRAINT IF EXISTS ports_chassis_face_check`
      )
    })

    this.schema.alterTable('ports', (table) => {
      table.dropColumn('chassis_face')
    })
    this.schema.alterTable('device_template_ports', (table) => {
      table.dropColumn('chassis_face')
    })
    this.schema.alterTable('device_templates', (table) => {
      table.dropColumn('is_full_depth')
    })
  }
}
