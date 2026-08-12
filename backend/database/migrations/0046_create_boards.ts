import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('boards', (table) => {
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
      table.string('kind', 40).notNullable().defaultTo('generic')
      table.integer('grid_rows').notNullable().defaultTo(6)
      table.integer('grid_cols').notNullable().defaultTo(8)
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
        .uuid('board_id')
        .nullable()
        .references('id')
        .inTable('boards')
        .onDelete('SET NULL')
      table.integer('board_row').nullable()
      table.integer('board_col').nullable()
      table.integer('board_row_span').nullable()
      table.integer('board_col_span').nullable()
      table.index(['board_id'])
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        ALTER TABLE boards
        ADD CONSTRAINT boards_kind_check
        CHECK (kind IN ('electrical', 'communications', 'generic'))
      `)
      await db.rawQuery(`
        ALTER TABLE boards
        ADD CONSTRAINT boards_grid_rows_check
        CHECK (grid_rows >= 1 AND grid_rows <= 40)
      `)
      await db.rawQuery(`
        ALTER TABLE boards
        ADD CONSTRAINT boards_grid_cols_check
        CHECK (grid_cols >= 1 AND grid_cols <= 40)
      `)
      await db.rawQuery(`
        ALTER TABLE devices
        ADD CONSTRAINT devices_board_row_check
        CHECK (board_row IS NULL OR board_row >= 0)
      `)
      await db.rawQuery(`
        ALTER TABLE devices
        ADD CONSTRAINT devices_board_col_check
        CHECK (board_col IS NULL OR board_col >= 0)
      `)
      await db.rawQuery(`
        ALTER TABLE devices
        ADD CONSTRAINT devices_board_row_span_check
        CHECK (board_row_span IS NULL OR board_row_span >= 1)
      `)
      await db.rawQuery(`
        ALTER TABLE devices
        ADD CONSTRAINT devices_board_col_span_check
        CHECK (board_col_span IS NULL OR board_col_span >= 1)
      `)
      await db.rawQuery(`
        ALTER TABLE devices
        ADD CONSTRAINT devices_board_rack_mutex_check
        CHECK (board_id IS NULL OR rack_id IS NULL)
      `)
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery(
        `ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_board_rack_mutex_check`
      )
      await db.rawQuery(
        `ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_board_col_span_check`
      )
      await db.rawQuery(
        `ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_board_row_span_check`
      )
      await db.rawQuery(`ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_board_col_check`)
      await db.rawQuery(`ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_board_row_check`)
      await db.rawQuery(`ALTER TABLE boards DROP CONSTRAINT IF EXISTS boards_grid_cols_check`)
      await db.rawQuery(`ALTER TABLE boards DROP CONSTRAINT IF EXISTS boards_grid_rows_check`)
      await db.rawQuery(`ALTER TABLE boards DROP CONSTRAINT IF EXISTS boards_kind_check`)
    })

    this.schema.alterTable('devices', (table) => {
      table.dropIndex(['board_id'])
      table.dropColumn('board_col_span')
      table.dropColumn('board_row_span')
      table.dropColumn('board_col')
      table.dropColumn('board_row')
      table.dropColumn('board_id')
    })
    this.schema.dropTable('boards')
  }
}
