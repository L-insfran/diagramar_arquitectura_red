import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * ADR 0006 addendum: kind chassis — solid rackmount (e.g. PC) with no device hosting.
 * Height 1–4U, single face, full width 6/6, device_slot_count = 0.
 */
export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      await db.rawQuery(
        `ALTER TABLE rack_accessory_templates DROP CONSTRAINT IF EXISTS rack_accessory_templates_kind_check`
      )
      await db.rawQuery(`
        ALTER TABLE rack_accessory_templates
        ADD CONSTRAINT rack_accessory_templates_kind_check
        CHECK (kind IN ('shelf', 'hang', 'chassis'))
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
          OR (kind = 'chassis' AND height_u BETWEEN 1 AND 4)
        )
      `)

      await db.rawQuery(
        `ALTER TABLE rack_accessory_templates DROP CONSTRAINT IF EXISTS rack_accessory_templates_device_slot_count_check`
      )
      await db.rawQuery(`
        ALTER TABLE rack_accessory_templates
        ADD CONSTRAINT rack_accessory_templates_device_slot_count_check
        CHECK (
          (kind IN ('shelf', 'hang') AND device_slot_count BETWEEN 3 AND 5)
          OR (kind = 'chassis' AND device_slot_count = 0)
        )
      `)

      await db.rawQuery(
        `ALTER TABLE rack_accessory_templates DROP CONSTRAINT IF EXISTS rack_accessory_templates_face_check`
      )
      await db.rawQuery(`
        ALTER TABLE rack_accessory_templates
        ADD CONSTRAINT rack_accessory_templates_face_check
        CHECK (
          (kind = 'shelf' AND face IS NULL)
          OR (kind IN ('hang', 'chassis') AND face IN ('front', 'rear'))
        )
      `)

      await db.rawQuery(
        `ALTER TABLE rack_accessories DROP CONSTRAINT IF EXISTS rack_accessories_kind_check`
      )
      await db.rawQuery(`
        ALTER TABLE rack_accessories
        ADD CONSTRAINT rack_accessories_kind_check
        CHECK (kind IN ('shelf', 'hang', 'chassis'))
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
          OR (kind = 'chassis' AND height_u BETWEEN 1 AND 4)
        )
      `)

      await db.rawQuery(
        `ALTER TABLE rack_accessories DROP CONSTRAINT IF EXISTS rack_accessories_device_slot_count_check`
      )
      await db.rawQuery(`
        ALTER TABLE rack_accessories
        ADD CONSTRAINT rack_accessories_device_slot_count_check
        CHECK (
          (kind IN ('shelf', 'hang') AND device_slot_count BETWEEN 3 AND 5)
          OR (kind = 'chassis' AND device_slot_count = 0)
        )
      `)

      await db.rawQuery(
        `ALTER TABLE rack_accessories DROP CONSTRAINT IF EXISTS rack_accessories_face_check`
      )
      await db.rawQuery(`
        ALTER TABLE rack_accessories
        ADD CONSTRAINT rack_accessories_face_check
        CHECK (
          (kind = 'shelf' AND face IS NULL)
          OR (kind IN ('hang', 'chassis') AND face IN ('front', 'rear'))
        )
      `)

      await db.table('rack_accessory_templates').insert({
        name: 'HCM2-19-SS-1U-BK-C',
        kind: 'chassis',
        height_u: 1,
        default_mount_type: 'front_only',
        device_slot_count: 0,
        face: 'front',
        horizontal_slot_start: 0,
        horizontal_width_slots: 6,
        model: 'HCM2-19-SS-1U-BK-C',
        notes:
          'Ordenador / chasis rackeable. Sin hospedaje de equipos. Una cara, ancho completo 6/6; altura de instancia 1–4U.',
      })
    })
  }

  async down() {
    this.defer(async (db) => {
      await db
        .from('rack_accessory_templates')
        .where('kind', 'chassis')
        .where('model', 'HCM2-19-SS-1U-BK-C')
        .delete()

      await db.rawQuery(
        `ALTER TABLE rack_accessories DROP CONSTRAINT IF EXISTS rack_accessories_face_check`
      )
      await db.rawQuery(`
        ALTER TABLE rack_accessories
        ADD CONSTRAINT rack_accessories_face_check
        CHECK (
          (kind = 'shelf' AND face IS NULL)
          OR (kind = 'hang' AND face IN ('front', 'rear'))
        )
      `)
      await db.rawQuery(
        `ALTER TABLE rack_accessories DROP CONSTRAINT IF EXISTS rack_accessories_device_slot_count_check`
      )
      await db.rawQuery(`
        ALTER TABLE rack_accessories
        ADD CONSTRAINT rack_accessories_device_slot_count_check
        CHECK (device_slot_count BETWEEN 3 AND 5)
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
      await db.rawQuery(
        `ALTER TABLE rack_accessories DROP CONSTRAINT IF EXISTS rack_accessories_kind_check`
      )
      await db.rawQuery(`
        ALTER TABLE rack_accessories
        ADD CONSTRAINT rack_accessories_kind_check
        CHECK (kind IN ('shelf', 'hang'))
      `)

      await db.rawQuery(
        `ALTER TABLE rack_accessory_templates DROP CONSTRAINT IF EXISTS rack_accessory_templates_face_check`
      )
      await db.rawQuery(`
        ALTER TABLE rack_accessory_templates
        ADD CONSTRAINT rack_accessory_templates_face_check
        CHECK (
          (kind = 'shelf' AND face IS NULL)
          OR (kind = 'hang' AND face IN ('front', 'rear'))
        )
      `)
      await db.rawQuery(
        `ALTER TABLE rack_accessory_templates DROP CONSTRAINT IF EXISTS rack_accessory_templates_device_slot_count_check`
      )
      await db.rawQuery(`
        ALTER TABLE rack_accessory_templates
        ADD CONSTRAINT rack_accessory_templates_device_slot_count_check
        CHECK (device_slot_count BETWEEN 3 AND 5)
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
      await db.rawQuery(
        `ALTER TABLE rack_accessory_templates DROP CONSTRAINT IF EXISTS rack_accessory_templates_kind_check`
      )
      await db.rawQuery(`
        ALTER TABLE rack_accessory_templates
        ADD CONSTRAINT rack_accessory_templates_kind_check
        CHECK (kind IN ('shelf', 'hang'))
      `)
    })
  }
}
