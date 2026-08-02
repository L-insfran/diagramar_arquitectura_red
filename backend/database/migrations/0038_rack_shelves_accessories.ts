import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Bandejas rackeables (ADR 0006): catálogo global + instancias por proyecto,
 * y colocación de devices apoyados (slots horizontales 1/3).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('rack_accessory_templates', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.string('name', 255).notNullable()
      table.string('kind', 40).notNullable().defaultTo('shelf')
      table.integer('height_u').notNullable()
      table.string('default_mount_type', 20).notNullable().defaultTo('front_only')
      table.string('manufacturer', 255).nullable()
      table.string('model', 255).nullable()
      table.text('notes').nullable()
      table
        .uuid('created_by')
        .nullable()
        .references('id')
        .inTable('system_users')
        .onDelete('SET NULL')
      table
        .uuid('updated_by')
        .nullable()
        .references('id')
        .inTable('system_users')
        .onDelete('SET NULL')
      table
        .uuid('deleted_by')
        .nullable()
        .references('id')
        .inTable('system_users')
        .onDelete('SET NULL')
      table.timestamp('deleted_at', { useTz: true }).nullable()
      table.timestamps(true, true)
      table.index(['kind'])
      table.index(['deleted_at'])
    })

    this.schema.createTable('rack_accessories', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('project_id')
        .notNullable()
        .references('id')
        .inTable('projects')
        .onDelete('CASCADE')
      table
        .uuid('rack_id')
        .notNullable()
        .references('id')
        .inTable('racks')
        .onDelete('RESTRICT')
      table
        .uuid('accessory_template_id')
        .nullable()
        .references('id')
        .inTable('rack_accessory_templates')
        .onDelete('SET NULL')
      table.string('name', 255).notNullable()
      table.string('kind', 40).notNullable().defaultTo('shelf')
      table.integer('unit_start').notNullable()
      table.integer('height_u').notNullable()
      table.string('mount_type', 20).notNullable()
      table.string('manufacturer', 255).nullable()
      table.string('model', 255).nullable()
      table.text('notes').nullable()
      table
        .uuid('created_by')
        .nullable()
        .references('id')
        .inTable('system_users')
        .onDelete('SET NULL')
      table
        .uuid('updated_by')
        .nullable()
        .references('id')
        .inTable('system_users')
        .onDelete('SET NULL')
      table
        .uuid('deleted_by')
        .nullable()
        .references('id')
        .inTable('system_users')
        .onDelete('SET NULL')
      table.timestamp('deleted_at', { useTz: true }).nullable()
      table.timestamps(true, true)
      table.index(['project_id'])
      table.index(['rack_id'])
      table.index(['deleted_at'])
    })

    this.schema.alterTable('devices', (table) => {
      table
        .uuid('supported_by_accessory_id')
        .nullable()
        .references('id')
        .inTable('rack_accessories')
        .onDelete('SET NULL')
      table.integer('shelf_slot_start').nullable()
      table.integer('shelf_width_slots').nullable()
      table.index(['supported_by_accessory_id'])
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        ALTER TABLE rack_accessory_templates
        ADD CONSTRAINT rack_accessory_templates_kind_check
        CHECK (kind IN ('shelf'))
      `)
      await db.rawQuery(`
        ALTER TABLE rack_accessory_templates
        ADD CONSTRAINT rack_accessory_templates_height_u_check
        CHECK (height_u IN (1, 2))
      `)
      await db.rawQuery(`
        ALTER TABLE rack_accessory_templates
        ADD CONSTRAINT rack_accessory_templates_mount_check
        CHECK (default_mount_type IN ('front_only', 'four_post'))
      `)
      await db.rawQuery(`
        ALTER TABLE rack_accessories
        ADD CONSTRAINT rack_accessories_kind_check
        CHECK (kind IN ('shelf'))
      `)
      await db.rawQuery(`
        ALTER TABLE rack_accessories
        ADD CONSTRAINT rack_accessories_height_u_check
        CHECK (height_u IN (1, 2))
      `)
      await db.rawQuery(`
        ALTER TABLE rack_accessories
        ADD CONSTRAINT rack_accessories_unit_start_check
        CHECK (unit_start >= 1)
      `)
      await db.rawQuery(`
        ALTER TABLE rack_accessories
        ADD CONSTRAINT rack_accessories_mount_check
        CHECK (mount_type IN ('front_only', 'four_post'))
      `)
      await db.rawQuery(`
        ALTER TABLE devices
        ADD CONSTRAINT devices_shelf_slot_start_check
        CHECK (shelf_slot_start IS NULL OR shelf_slot_start IN (0, 1, 2))
      `)
      await db.rawQuery(`
        ALTER TABLE devices
        ADD CONSTRAINT devices_shelf_width_slots_check
        CHECK (shelf_width_slots IS NULL OR shelf_width_slots IN (1, 3))
      `)

      await db.table('rack_accessory_templates').multiInsert([
        {
          name: 'Bandeja 1U',
          kind: 'shelf',
          height_u: 1,
          default_mount_type: 'front_only',
          notes: 'Bandeja fija de 1U. Fijación frontal típica en racks murales o abiertos.',
        },
        {
          name: 'Bandeja 2U',
          kind: 'shelf',
          height_u: 2,
          default_mount_type: 'four_post',
          notes: 'Bandeja fija de 2U. Preferible fijación integral (4 postes) en racks de piso.',
        },
      ])
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery(`ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_shelf_width_slots_check`)
      await db.rawQuery(`ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_shelf_slot_start_check`)
      await db.rawQuery(`ALTER TABLE rack_accessories DROP CONSTRAINT IF EXISTS rack_accessories_mount_check`)
      await db.rawQuery(
        `ALTER TABLE rack_accessories DROP CONSTRAINT IF EXISTS rack_accessories_unit_start_check`
      )
      await db.rawQuery(
        `ALTER TABLE rack_accessories DROP CONSTRAINT IF EXISTS rack_accessories_height_u_check`
      )
      await db.rawQuery(`ALTER TABLE rack_accessories DROP CONSTRAINT IF EXISTS rack_accessories_kind_check`)
      await db.rawQuery(
        `ALTER TABLE rack_accessory_templates DROP CONSTRAINT IF EXISTS rack_accessory_templates_mount_check`
      )
      await db.rawQuery(
        `ALTER TABLE rack_accessory_templates DROP CONSTRAINT IF EXISTS rack_accessory_templates_height_u_check`
      )
      await db.rawQuery(
        `ALTER TABLE rack_accessory_templates DROP CONSTRAINT IF EXISTS rack_accessory_templates_kind_check`
      )
    })

    this.schema.alterTable('devices', (table) => {
      table.dropIndex(['supported_by_accessory_id'])
      table.dropColumn('shelf_width_slots')
      table.dropColumn('shelf_slot_start')
      table.dropColumn('supported_by_accessory_id')
    })
    this.schema.dropTable('rack_accessories')
    this.schema.dropTable('rack_accessory_templates')
  }
}
