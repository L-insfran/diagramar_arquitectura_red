import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'port_vlans'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('port_id')
        .notNullable()
        .references('id')
        .inTable('ports')
        .onDelete('CASCADE')
      table
        .uuid('vlan_id')
        .notNullable()
        .references('id')
        .inTable('vlans')
        .onDelete('CASCADE')
      table.boolean('is_tagged').notNullable().defaultTo(false)
      table.timestamps(true, true)
      table.unique(['port_id', 'vlan_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
