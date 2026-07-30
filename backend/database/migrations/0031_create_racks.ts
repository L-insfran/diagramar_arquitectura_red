import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('racks', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('project_id')
        .notNullable()
        .references('id')
        .inTable('projects')
        .onDelete('CASCADE')
      table
        .uuid('area_id')
        .notNullable()
        .references('id')
        .inTable('areas')
        .onDelete('RESTRICT')
      table.string('name', 255).notNullable()
      table.string('code', 100).nullable()
      table.integer('height_u').notNullable().defaultTo(42)
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
      table.index(['area_id'])
      table.index(['deleted_at'])
    })

    this.schema.alterTable('devices', (table) => {
      table
        .uuid('rack_id')
        .nullable()
        .references('id')
        .inTable('racks')
        .onDelete('SET NULL')
      table.integer('rack_unit_start').nullable()
      table.string('rack_face', 10).nullable()
      table.index(['rack_id'])
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        ALTER TABLE racks
        ADD CONSTRAINT racks_height_u_check
        CHECK (height_u >= 1 AND height_u <= 60)
      `)
      await db.rawQuery(`
        ALTER TABLE devices
        ADD CONSTRAINT devices_rack_face_check
        CHECK (rack_face IS NULL OR rack_face IN ('front', 'rear'))
      `)
      await db.rawQuery(`
        ALTER TABLE devices
        ADD CONSTRAINT devices_rack_unit_start_check
        CHECK (rack_unit_start IS NULL OR rack_unit_start >= 1)
      `)
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery(`ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_rack_unit_start_check`)
      await db.rawQuery(`ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_rack_face_check`)
      await db.rawQuery(`ALTER TABLE racks DROP CONSTRAINT IF EXISTS racks_height_u_check`)
    })

    this.schema.alterTable('devices', (table) => {
      table.dropIndex(['rack_id'])
      table.dropColumn('rack_face')
      table.dropColumn('rack_unit_start')
      table.dropColumn('rack_id')
    })
    this.schema.dropTable('racks')
  }
}
