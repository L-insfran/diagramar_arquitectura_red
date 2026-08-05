import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * ADR 0006 addendum: kind hang + device_slot_count (3–5) + face for hang.
 * Device shelf slots generalize beyond fixed thirds (0–2 / width 1|3).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('rack_accessory_templates', (table) => {
      table.integer('device_slot_count').notNullable().defaultTo(3)
      table.string('face', 10).nullable()
    })

    this.schema.alterTable('rack_accessories', (table) => {
      table.integer('device_slot_count').notNullable().defaultTo(3)
      table.string('face', 10).nullable()
    })

    this.defer(async (db) => {
      await db.rawQuery(
        `ALTER TABLE rack_accessory_templates DROP CONSTRAINT IF EXISTS rack_accessory_templates_kind_check`
      )
      await db.rawQuery(`
        ALTER TABLE rack_accessory_templates
        ADD CONSTRAINT rack_accessory_templates_kind_check
        CHECK (kind IN ('shelf', 'hang'))
      `)
      await db.rawQuery(
        `ALTER TABLE rack_accessory_templates DROP CONSTRAINT IF EXISTS rack_accessory_templates_height_u_check`
      )
      await db.rawQuery(`
        ALTER TABLE rack_accessory_templates
        ADD CONSTRAINT rack_accessory_templates_height_u_check
        CHECK (
          (kind = 'shelf' AND height_u BETWEEN 1 AND 6)
          OR (kind = 'hang' AND height_u BETWEEN 1 AND 5)
        )
      `)
      await db.rawQuery(`
        ALTER TABLE rack_accessory_templates
        ADD CONSTRAINT rack_accessory_templates_device_slot_count_check
        CHECK (device_slot_count BETWEEN 3 AND 5)
      `)
      await db.rawQuery(`
        ALTER TABLE rack_accessory_templates
        ADD CONSTRAINT rack_accessory_templates_face_check
        CHECK (
          (kind = 'shelf' AND face IS NULL)
          OR (kind = 'hang' AND face IN ('front', 'rear'))
        )
      `)

      await db.rawQuery(
        `ALTER TABLE rack_accessories DROP CONSTRAINT IF EXISTS rack_accessories_kind_check`
      )
      await db.rawQuery(`
        ALTER TABLE rack_accessories
        ADD CONSTRAINT rack_accessories_kind_check
        CHECK (kind IN ('shelf', 'hang'))
      `)
      await db.rawQuery(
        `ALTER TABLE rack_accessories DROP CONSTRAINT IF EXISTS rack_accessories_height_u_check`
      )
      await db.rawQuery(`
        ALTER TABLE rack_accessories
        ADD CONSTRAINT rack_accessories_height_u_check
        CHECK (
          (kind = 'shelf' AND height_u BETWEEN 1 AND 6)
          OR (kind = 'hang' AND height_u BETWEEN 1 AND 5)
        )
      `)
      await db.rawQuery(`
        ALTER TABLE rack_accessories
        ADD CONSTRAINT rack_accessories_device_slot_count_check
        CHECK (device_slot_count BETWEEN 3 AND 5)
      `)
      await db.rawQuery(`
        ALTER TABLE rack_accessories
        ADD CONSTRAINT rack_accessories_face_check
        CHECK (
          (kind = 'shelf' AND face IS NULL)
          OR (kind = 'hang' AND face IN ('front', 'rear'))
        )
      `)

      await db.rawQuery(
        `ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_shelf_slot_start_check`
      )
      await db.rawQuery(`
        ALTER TABLE devices
        ADD CONSTRAINT devices_shelf_slot_start_check
        CHECK (shelf_slot_start IS NULL OR shelf_slot_start BETWEEN 0 AND 4)
      `)
      await db.rawQuery(
        `ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_shelf_width_slots_check`
      )
      await db.rawQuery(`
        ALTER TABLE devices
        ADD CONSTRAINT devices_shelf_width_slots_check
        CHECK (shelf_width_slots IS NULL OR shelf_width_slots BETWEEN 1 AND 5)
      `)

      await db.table('rack_accessory_templates').insert({
        name: 'Accesorio colgante 3U',
        kind: 'hang',
        height_u: 3,
        default_mount_type: 'front_only',
        device_slot_count: 3,
        face: 'front',
        notes: 'Accesorio colgante de 3U en una cara. Equipos colgados lado a lado (hasta 5).',
      })
    })
  }

  async down() {
    this.defer(async (db) => {
      await db
        .from('rack_accessory_templates')
        .where('kind', 'hang')
        .where('name', 'Accesorio colgante 3U')
        .delete()

      await db.rawQuery(
        `ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_shelf_width_slots_check`
      )
      await db.rawQuery(`
        ALTER TABLE devices
        ADD CONSTRAINT devices_shelf_width_slots_check
        CHECK (shelf_width_slots IS NULL OR shelf_width_slots IN (1, 3))
      `)
      await db.rawQuery(
        `ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_shelf_slot_start_check`
      )
      await db.rawQuery(`
        ALTER TABLE devices
        ADD CONSTRAINT devices_shelf_slot_start_check
        CHECK (shelf_slot_start IS NULL OR shelf_slot_start IN (0, 1, 2))
      `)

      await db.rawQuery(
        `ALTER TABLE rack_accessories DROP CONSTRAINT IF EXISTS rack_accessories_face_check`
      )
      await db.rawQuery(
        `ALTER TABLE rack_accessories DROP CONSTRAINT IF EXISTS rack_accessories_device_slot_count_check`
      )
      await db.rawQuery(
        `ALTER TABLE rack_accessories DROP CONSTRAINT IF EXISTS rack_accessories_height_u_check`
      )
      await db.rawQuery(`
        ALTER TABLE rack_accessories
        ADD CONSTRAINT rack_accessories_height_u_check
        CHECK (height_u BETWEEN 1 AND 6)
      `)
      await db.rawQuery(
        `ALTER TABLE rack_accessories DROP CONSTRAINT IF EXISTS rack_accessories_kind_check`
      )
      await db.rawQuery(`
        ALTER TABLE rack_accessories
        ADD CONSTRAINT rack_accessories_kind_check
        CHECK (kind IN ('shelf'))
      `)

      await db.rawQuery(
        `ALTER TABLE rack_accessory_templates DROP CONSTRAINT IF EXISTS rack_accessory_templates_face_check`
      )
      await db.rawQuery(
        `ALTER TABLE rack_accessory_templates DROP CONSTRAINT IF EXISTS rack_accessory_templates_device_slot_count_check`
      )
      await db.rawQuery(
        `ALTER TABLE rack_accessory_templates DROP CONSTRAINT IF EXISTS rack_accessory_templates_height_u_check`
      )
      await db.rawQuery(`
        ALTER TABLE rack_accessory_templates
        ADD CONSTRAINT rack_accessory_templates_height_u_check
        CHECK (height_u BETWEEN 1 AND 6)
      `)
      await db.rawQuery(
        `ALTER TABLE rack_accessory_templates DROP CONSTRAINT IF EXISTS rack_accessory_templates_kind_check`
      )
      await db.rawQuery(`
        ALTER TABLE rack_accessory_templates
        ADD CONSTRAINT rack_accessory_templates_kind_check
        CHECK (kind IN ('shelf'))
      `)
    })

    this.schema.alterTable('rack_accessories', (table) => {
      table.dropColumn('face')
      table.dropColumn('device_slot_count')
    })

    this.schema.alterTable('rack_accessory_templates', (table) => {
      table.dropColumn('face')
      table.dropColumn('device_slot_count')
    })
  }
}
