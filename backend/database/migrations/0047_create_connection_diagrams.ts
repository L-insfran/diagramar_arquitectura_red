import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('connection_diagrams', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('project_id')
        .notNullable()
        .references('id')
        .inTable('projects')
        .onDelete('CASCADE')
      table.string('name', 255).notNullable()
      table.text('description').nullable()
      table.jsonb('scope_site_ids').notNullable().defaultTo(this.raw(`'[]'::jsonb`))
      table.jsonb('scope_area_ids').notNullable().defaultTo(this.raw(`'[]'::jsonb`))
      table.jsonb('node_positions').notNullable().defaultTo(this.raw(`'{}'::jsonb`))
      table.jsonb('label_offsets').notNullable().defaultTo(this.raw(`'{}'::jsonb`))
      table.jsonb('edge_routes').notNullable().defaultTo(this.raw(`'{}'::jsonb`))
      table.jsonb('containers').notNullable().defaultTo(this.raw(`'{}'::jsonb`))
      table.jsonb('settings').notNullable().defaultTo(this.raw(`'{}'::jsonb`))
      table.integer('sort_order').notNullable().defaultTo(0)
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
      table.index(['deleted_at'])
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        CREATE UNIQUE INDEX connection_diagrams_project_name_unique
        ON connection_diagrams (project_id, lower(name))
        WHERE deleted_at IS NULL
      `)
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery(
        `DROP INDEX IF EXISTS connection_diagrams_project_name_unique`
      )
    })
    this.schema.dropTable('connection_diagrams')
  }
}
