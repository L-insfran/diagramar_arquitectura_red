import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'employee_credentials'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('employee_id')
        .notNullable()
        .references('id')
        .inTable('employees')
        .onDelete('CASCADE')
      table
        .uuid('company_id')
        .notNullable()
        .references('id')
        .inTable('companies')
        .onDelete('CASCADE')
      table
        .enum('kind', ['file_server', 'vpn', 'email', 'rdp', 'other'], {
          useNative: true,
          enumName: 'employee_credential_kind',
        })
        .notNullable()
        .defaultTo('file_server')
      // Human-readable label, e.g. "Servidor Contabilidad"
      table.string('label', 255).nullable()
      table.string('username', 255).notNullable()
      // AES-256-GCM encrypted: iv:authTag:ciphertext (hex)
      table.text('password_ciphertext').notNullable()
      table.text('notes').nullable()
      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
    this.schema.raw('DROP TYPE IF EXISTS employee_credential_kind')
  }
}
