import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'connections'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .string('medium_type', 20)
        .notNullable()
        .defaultTo('utp')
      table.string('cable_category', 10).nullable()
      table.string('fiber_type', 20).nullable()
      table.string('fiber_connector', 10).nullable()
      table.string('wifi_ssid', 100).nullable()
      table.string('wifi_standard', 20).nullable()
      table.string('wifi_band', 10).nullable()
      table.string('wifi_security', 20).nullable()
      table.string('cable_length', 20).nullable()
      table
        .string('connection_status', 20)
        .notNullable()
        .defaultTo('implemented')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('medium_type')
      table.dropColumn('cable_category')
      table.dropColumn('fiber_type')
      table.dropColumn('fiber_connector')
      table.dropColumn('wifi_ssid')
      table.dropColumn('wifi_standard')
      table.dropColumn('wifi_band')
      table.dropColumn('wifi_security')
      table.dropColumn('cable_length')
      table.dropColumn('connection_status')
    })
  }
}
