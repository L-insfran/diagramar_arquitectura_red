import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'device_credentials'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('device_id')
        .notNullable()
        .references('id')
        .inTable('devices')
        .onDelete('CASCADE')
      table
        .enum('credential_type', ['ssh', 'telnet', 'snmp', 'web', 'api'], {
          useNative: true,
          enumName: 'device_credentials_credential_type',
        })
        .notNullable()
        .defaultTo('ssh')
      table.string('username', 255).nullable()
      table.string('password', 255).notNullable()
      table.integer('port').unsigned().nullable()
      table.string('community_string', 255).nullable()
      table.text('notes').nullable()
      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
