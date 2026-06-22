import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'connections'

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
        .uuid('source_port_id')
        .notNullable()
        .references('id')
        .inTable('ports')
        .onDelete('CASCADE')
      table
        .uuid('target_port_id')
        .notNullable()
        .references('id')
        .inTable('ports')
        .onDelete('CASCADE')
      table
        .enum('connection_type', ['physical', 'logical'], {
          useNative: true,
          enumName: 'connections_connection_type',
        })
        .notNullable()
        .defaultTo('physical')
      table.string('bandwidth', 100).nullable()
      table.text('description').nullable()
      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
