import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'ports'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('device_id')
        .notNullable()
        .references('id')
        .inTable('devices')
        .onDelete('CASCADE')
      table.string('name', 100).notNullable()
      table.integer('port_number').notNullable()
      table
        .enum('port_type', ['ethernet', 'fiber', 'serial', 'wireless', 'wan', 'sfp'], {
          useNative: true,
          enumName: 'ports_port_type',
        })
        .notNullable()
        .defaultTo('ethernet')
      table.string('speed', 50).nullable()
      table
        .enum('status', ['up', 'down', 'disabled'], {
          useNative: true,
          enumName: 'ports_status',
        })
        .notNullable()
        .defaultTo('down')
      table.text('description').nullable()
      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
