import { BaseSchema } from '@adonisjs/lucid/schema'
import { randomUUID } from 'node:crypto'

export default class extends BaseSchema {
  protected tableName = 'company_memberships'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('system_user_id')
        .notNullable()
        .references('id')
        .inTable('system_users')
        .onDelete('CASCADE')
      table
        .uuid('company_id')
        .notNullable()
        .references('id')
        .inTable('companies')
        .onDelete('CASCADE')
      table
        .enum('role', ['admin', 'operator', 'viewer'], {
          useNative: true,
          enumName: 'company_memberships_role',
        })
        .notNullable()
        .defaultTo('viewer')
      table.boolean('is_default').notNullable().defaultTo(false)
      table.timestamps(true, true)

      table.unique(['system_user_id', 'company_id'])
      table.index(['company_id'])
    })

    this.defer(async (db) => {
      const users = await db.from('system_users').select('id', 'company_id', 'role')
      const now = new Date()
      for (const user of users) {
        await db.table(this.tableName).insert({
          id: randomUUID(),
          system_user_id: user.id,
          company_id: user.company_id,
          role: user.role,
          is_default: true,
          created_at: now,
          updated_at: now,
        })
      }
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
    this.schema.raw('DROP TYPE IF EXISTS company_memberships_role')
  }
}
