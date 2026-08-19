import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('containers', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE')
      table.uuid('area_id').notNullable().references('id').inTable('areas').onDelete('CASCADE')
      table.string('kind', 20).notNullable() // 'default' | 'rack' | 'board'
      table.string('name', 255).notNullable()
      table.string('code', 100).nullable()
      table.string('manufacturer', 255).nullable()
      table.string('model', 255).nullable()
      table.text('notes').nullable()

      // rack-specific
      table.integer('height_u').nullable()

      // board-specific
      table.string('board_kind', 30).nullable() // 'electrical' | 'communications' | 'generic'
      table.integer('grid_rows').nullable()
      table.integer('grid_cols').nullable()

      // audit + soft delete
      table.uuid('created_by').nullable()
      table.uuid('updated_by').nullable()
      table.uuid('deleted_by').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('deleted_at', { useTz: true }).nullable()

      table.index(['project_id'])
      table.index(['area_id'])
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        ALTER TABLE containers
          ADD CONSTRAINT containers_kind_check CHECK (kind IN ('default','rack','board')),
          ADD CONSTRAINT containers_rack_height CHECK (kind <> 'rack' OR height_u IS NOT NULL),
          ADD CONSTRAINT containers_board_grid CHECK (
            kind <> 'board' OR (board_kind IS NOT NULL AND grid_rows IS NOT NULL AND grid_cols IS NOT NULL)
          )
      `)
    })
  }

  async down() {
    this.schema.dropTable('containers')
  }
}
