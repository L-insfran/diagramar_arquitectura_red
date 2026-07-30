import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Device templates become a platform-wide catalog (no project_id).
 * Existing rows are kept; devices keep their own project_id.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('device_templates', (table) => {
      table.dropIndex(['project_id', 'manufacturer', 'model'])
      table.dropIndex(['project_id'])
      table.dropForeign(['project_id'])
      table.dropColumn('project_id')
      table.index(['manufacturer', 'model'])
    })
  }

  async down() {
    this.schema.alterTable('device_templates', (table) => {
      table.dropIndex(['manufacturer', 'model'])
      table
        .uuid('project_id')
        .nullable()
        .references('id')
        .inTable('projects')
        .onDelete('CASCADE')
      table.index(['project_id'])
      table.index(['project_id', 'manufacturer', 'model'])
    })
  }
}
