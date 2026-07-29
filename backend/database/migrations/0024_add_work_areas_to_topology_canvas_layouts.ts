import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'topology_canvas_layouts'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.jsonb('work_areas').notNullable().defaultTo('[]')
      table.jsonb('node_parents').notNullable().defaultTo('{}')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('work_areas')
      table.dropColumn('node_parents')
    })
  }
}
