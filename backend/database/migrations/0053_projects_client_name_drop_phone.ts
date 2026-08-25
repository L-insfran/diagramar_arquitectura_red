import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'projects'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.renameColumn('domain', 'client_name')
      table.dropColumn('phone')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.renameColumn('client_name', 'domain')
      table.string('phone', 50).nullable()
    })
  }
}
