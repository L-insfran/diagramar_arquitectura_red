import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Accesorios de rack: altura 1–6U y huella horizontal en rejilla de 6 columnas.
 * Defaults: horizontal_slot_start=0, horizontal_width_slots=6 (ancho completo).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('rack_accessory_templates', (table) => {
      table.integer('horizontal_slot_start').notNullable().defaultTo(0)
      table.integer('horizontal_width_slots').notNullable().defaultTo(6)
    })

    this.schema.alterTable('rack_accessories', (table) => {
      table.integer('horizontal_slot_start').notNullable().defaultTo(0)
      table.integer('horizontal_width_slots').notNullable().defaultTo(6)
    })

    this.defer(async (db) => {
      await db.rawQuery(
        `ALTER TABLE rack_accessory_templates DROP CONSTRAINT IF EXISTS rack_accessory_templates_height_u_check`
      )
      await db.rawQuery(`
        ALTER TABLE rack_accessory_templates
        ADD CONSTRAINT rack_accessory_templates_height_u_check
        CHECK (height_u BETWEEN 1 AND 6)
      `)
      await db.rawQuery(`
        ALTER TABLE rack_accessory_templates
        ADD CONSTRAINT rack_accessory_templates_horizontal_slots_check
        CHECK (
          horizontal_width_slots BETWEEN 2 AND 6
          AND horizontal_slot_start >= 0
          AND horizontal_slot_start + horizontal_width_slots <= 6
        )
      `)

      await db.rawQuery(
        `ALTER TABLE rack_accessories DROP CONSTRAINT IF EXISTS rack_accessories_height_u_check`
      )
      await db.rawQuery(`
        ALTER TABLE rack_accessories
        ADD CONSTRAINT rack_accessories_height_u_check
        CHECK (height_u BETWEEN 1 AND 6)
      `)
      await db.rawQuery(`
        ALTER TABLE rack_accessories
        ADD CONSTRAINT rack_accessories_horizontal_slots_check
        CHECK (
          horizontal_width_slots BETWEEN 2 AND 6
          AND horizontal_slot_start >= 0
          AND horizontal_slot_start + horizontal_width_slots <= 6
        )
      `)
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery(
        `ALTER TABLE rack_accessories DROP CONSTRAINT IF EXISTS rack_accessories_horizontal_slots_check`
      )
      await db.rawQuery(
        `ALTER TABLE rack_accessories DROP CONSTRAINT IF EXISTS rack_accessories_height_u_check`
      )
      await db.rawQuery(`
        ALTER TABLE rack_accessories
        ADD CONSTRAINT rack_accessories_height_u_check
        CHECK (height_u IN (1, 2))
      `)

      await db.rawQuery(
        `ALTER TABLE rack_accessory_templates DROP CONSTRAINT IF EXISTS rack_accessory_templates_horizontal_slots_check`
      )
      await db.rawQuery(
        `ALTER TABLE rack_accessory_templates DROP CONSTRAINT IF EXISTS rack_accessory_templates_height_u_check`
      )
      await db.rawQuery(`
        ALTER TABLE rack_accessory_templates
        ADD CONSTRAINT rack_accessory_templates_height_u_check
        CHECK (height_u IN (1, 2))
      `)
    })

    this.schema.alterTable('rack_accessories', (table) => {
      table.dropColumn('horizontal_width_slots')
      table.dropColumn('horizontal_slot_start')
    })

    this.schema.alterTable('rack_accessory_templates', (table) => {
      table.dropColumn('horizontal_width_slots')
      table.dropColumn('horizontal_slot_start')
    })
  }
}
