import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Catálogo por proyecto de tipos de enlace (función + color).
 * El color vive en el tipo; diagram_links solo guarda la FK.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('diagram_link_types', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('project_id')
        .notNullable()
        .references('id')
        .inTable('projects')
        .onDelete('CASCADE')
      table.string('name', 80).notNullable()
      table.string('color', 7).notNullable()
      table.text('description').nullable()
      table.integer('sort_order').notNullable().defaultTo(0)
      table.boolean('is_default').notNullable().defaultTo(false)
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

    this.schema.alterTable('diagram_links', (table) => {
      table
        .uuid('link_type_id')
        .nullable()
        .references('id')
        .inTable('diagram_link_types')
        .onDelete('SET NULL')
      table.index(['link_type_id'])
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        CREATE UNIQUE INDEX diagram_link_types_project_name_active_uidx
        ON diagram_link_types (project_id, lower(name))
        WHERE deleted_at IS NULL
      `)
      await db.rawQuery(`
        CREATE UNIQUE INDEX diagram_link_types_project_default_active_uidx
        ON diagram_link_types (project_id)
        WHERE is_default = true AND deleted_at IS NULL
      `)
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery(`DROP INDEX IF EXISTS diagram_link_types_project_name_active_uidx`)
      await db.rawQuery(`DROP INDEX IF EXISTS diagram_link_types_project_default_active_uidx`)
    })

    this.schema.alterTable('diagram_links', (table) => {
      table.dropIndex(['link_type_id'])
      table.dropColumn('link_type_id')
    })

    this.schema.dropTable('diagram_link_types')
  }
}
