import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'devices'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
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
      table.index(['deleted_at'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['deleted_at'])
      table.dropColumn('deleted_at')
      table.dropColumn('deleted_by')
      table.dropColumn('updated_by')
      table.dropColumn('created_by')
    })
  }
}
