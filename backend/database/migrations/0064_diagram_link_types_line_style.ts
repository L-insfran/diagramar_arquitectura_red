import { BaseSchema } from '@adonisjs/lucid/schema'

/** Estilo de trazo del tipo de enlace. El patrón visual vive en el cliente. */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('diagram_link_types', (table) => {
      table.string('line_style', 20).notNullable().defaultTo('solid')
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        ALTER TABLE diagram_link_types
        ADD CONSTRAINT diagram_link_types_line_style_check
        CHECK (line_style IN (
          'solid',
          'long_dash',
          'short_dash',
          'dotted',
          'dash_dot',
          'dash_dot_dot'
        ))
      `)
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery(`
        ALTER TABLE diagram_link_types
        DROP CONSTRAINT IF EXISTS diagram_link_types_line_style_check
      `)
    })

    this.schema.alterTable('diagram_link_types', (table) => {
      table.dropColumn('line_style')
    })
  }
}
