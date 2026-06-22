import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'devices'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('company_id')
        .notNullable()
        .references('id')
        .inTable('companies')
        .onDelete('CASCADE')
      table
        .uuid('device_type_id')
        .notNullable()
        .references('id')
        .inTable('device_types')
        .onDelete('RESTRICT')
      table.string('name', 255).notNullable()
      table.string('hostname', 255).nullable()
      table.string('ip_address', 45).nullable()
      table.string('mac_address', 17).nullable()
      table.string('model', 255).nullable()
      table.string('manufacturer', 255).nullable()
      table.string('serial_number', 255).nullable()
      table.string('firmware_version', 100).nullable()
      table.string('location', 255).nullable()
      table
        .enum('status', ['online', 'offline', 'maintenance', 'unknown'], {
          useNative: true,
          enumName: 'devices_status',
        })
        .notNullable()
        .defaultTo('unknown')
      table.text('notes').nullable()
      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
