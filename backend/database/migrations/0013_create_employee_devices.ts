import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'employee_devices'

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
        .uuid('device_id')
        .notNullable()
        .references('id')
        .inTable('devices')
        .onDelete('CASCADE')
      table.string('role', 100).nullable()
      table.timestamp('assigned_at').notNullable().defaultTo(this.now())
      table.timestamps(true, true)
      table.unique(['employee_id', 'device_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
