import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      // Drop the board↔rack exclusion CHECK
      await db.rawQuery(`
        ALTER TABLE devices
        DROP CONSTRAINT IF EXISTS devices_board_rack_exclusive
      `)

      // Drop old FKs - naming may vary so use a safe approach
      await db.rawQuery(`
        DO $$
        DECLARE r RECORD;
        BEGIN
          FOR r IN (
            SELECT constraint_name FROM information_schema.table_constraints
            WHERE table_name = 'devices'
              AND constraint_type = 'FOREIGN KEY'
              AND constraint_name LIKE '%rack_id%'
          ) LOOP
            EXECUTE 'ALTER TABLE devices DROP CONSTRAINT ' || r.constraint_name;
          END LOOP;
          FOR r IN (
            SELECT constraint_name FROM information_schema.table_constraints
            WHERE table_name = 'devices'
              AND constraint_type = 'FOREIGN KEY'
              AND constraint_name LIKE '%board_id%'
          ) LOOP
            EXECUTE 'ALTER TABLE devices DROP CONSTRAINT ' || r.constraint_name;
          END LOOP;
        END $$
      `)
    })

    this.schema.alterTable('devices', (table) => {
      table.dropColumn('rack_id')
      table.dropColumn('board_id')
    })

    this.defer(async (db) => {
      // Drop old rack_id FK from rack_accessories
      await db.rawQuery(`
        DO $$
        DECLARE r RECORD;
        BEGIN
          FOR r IN (
            SELECT constraint_name FROM information_schema.table_constraints
            WHERE table_name = 'rack_accessories'
              AND constraint_type = 'FOREIGN KEY'
              AND constraint_name LIKE '%rack_id%'
          ) LOOP
            EXECUTE 'ALTER TABLE rack_accessories DROP CONSTRAINT ' || r.constraint_name;
          END LOOP;
        END $$
      `)
    })

    this.schema.alterTable('rack_accessories', (table) => {
      table.dropColumn('rack_id')
    })

    // Drop old tables
    this.schema.dropTable('boards')
    this.schema.dropTable('racks')
  }

  async down() {
    // Recreating racks/boards would require data that no longer exists; 
    // this is a destructive migration.
    this.schema.createTable('racks', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('project_id').notNullable()
      table.uuid('area_id').notNullable()
      table.string('name', 255).notNullable()
      table.string('code', 100).nullable()
      table.integer('height_u').notNullable().defaultTo(42)
      table.string('manufacturer', 255).nullable()
      table.string('model', 255).nullable()
      table.text('notes').nullable()
      table.uuid('created_by').nullable()
      table.uuid('updated_by').nullable()
      table.uuid('deleted_by').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('deleted_at', { useTz: true }).nullable()
    })

    this.schema.createTable('boards', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('project_id').notNullable()
      table.uuid('area_id').notNullable()
      table.string('name', 255).notNullable()
      table.string('code', 100).nullable()
      table.string('kind', 30).notNullable().defaultTo('generic')
      table.integer('grid_rows').notNullable().defaultTo(10)
      table.integer('grid_cols').notNullable().defaultTo(10)
      table.string('manufacturer', 255).nullable()
      table.string('model', 255).nullable()
      table.text('notes').nullable()
      table.uuid('created_by').nullable()
      table.uuid('updated_by').nullable()
      table.uuid('deleted_by').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('deleted_at', { useTz: true }).nullable()
    })

    this.schema.alterTable('devices', (table) => {
      table.uuid('rack_id').nullable()
      table.uuid('board_id').nullable()
    })

    this.schema.alterTable('rack_accessories', (table) => {
      table.uuid('rack_id').nullable()
    })
  }
}
