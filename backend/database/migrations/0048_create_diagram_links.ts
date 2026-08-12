import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('diagram_links', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('project_id')
        .notNullable()
        .references('id')
        .inTable('projects')
        .onDelete('CASCADE')
      table
        .uuid('source_device_id')
        .notNullable()
        .references('id')
        .inTable('devices')
        .onDelete('CASCADE')
      table
        .uuid('target_device_id')
        .notNullable()
        .references('id')
        .inTable('devices')
        .onDelete('CASCADE')
      table
        .uuid('source_port_id')
        .nullable()
        .references('id')
        .inTable('ports')
        .onDelete('SET NULL')
      table
        .uuid('target_port_id')
        .nullable()
        .references('id')
        .inTable('ports')
        .onDelete('SET NULL')
      table.string('source_port_label', 255).notNullable()
      table.string('target_port_label', 255).notNullable()
      table.text('description').nullable()
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
      table.index(['source_device_id'])
      table.index(['target_device_id'])
    })
  }

  async down() {
    this.schema.dropTable('diagram_links')
  }
}
