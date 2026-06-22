import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'networks'

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
        .uuid('vlan_id')
        .nullable()
        .references('id')
        .inTable('vlans')
        .onDelete('SET NULL')
      table.string('name', 255).notNullable()
      table.string('subnet', 100).notNullable()
      table.string('gateway', 45).nullable()
      table.string('dns_primary', 45).nullable()
      table.string('dns_secondary', 45).nullable()
      table.boolean('dhcp_enabled').notNullable().defaultTo(false)
      table.text('description').nullable()
      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
