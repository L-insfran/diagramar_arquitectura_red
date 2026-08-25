import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'diagram_links'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .uuid('cable_type_id')
        .nullable()
        .references('id')
        .inTable('cable_types')
        .onDelete('SET NULL')
      table.index(['cable_type_id'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['cable_type_id'])
      table.dropColumn('cable_type_id')
    })
  }
}
