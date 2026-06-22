import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'topology_canvas_layouts'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE')
      table.string('layer', 16).notNullable()
      /** 'shared' para operadores/admin; UUID del usuario para vista de solo lectura personalizada */
      table.string('scope', 64).notNullable()
      table.jsonb('node_positions').notNullable().defaultTo('{}')
      table.jsonb('label_offsets').notNullable().defaultTo('{}')
      table.timestamps(true, true)

      table.unique(['company_id', 'layer', 'scope'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
