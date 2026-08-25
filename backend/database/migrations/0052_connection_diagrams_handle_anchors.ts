import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'connection_diagrams'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .jsonb('handle_anchors')
        .notNullable()
        .defaultTo(this.raw(`'{}'::jsonb`))
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('handle_anchors')
    })
  }
}
