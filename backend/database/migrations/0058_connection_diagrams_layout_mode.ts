import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'connection_diagrams'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('layout_mode', 16).notNullable().defaultTo('free')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('layout_mode')
    })
  }
}
