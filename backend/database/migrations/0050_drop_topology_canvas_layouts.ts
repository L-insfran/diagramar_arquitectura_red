import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.dropTableIfExists('topology_canvas_layouts')
  }

  async down() {
    this.schema.createTable('topology_canvas_layouts', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('project_id')
        .notNullable()
        .references('id')
        .inTable('projects')
        .onDelete('CASCADE')
      table.string('layer', 32).notNullable().defaultTo('unified')
      table.string('scope', 64).notNullable().defaultTo('shared')
      table.jsonb('node_positions').notNullable().defaultTo('{}')
      table.jsonb('label_offsets').notNullable().defaultTo('{}')
      table.jsonb('work_areas').notNullable().defaultTo('[]')
      table.jsonb('node_parents').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.unique(['project_id', 'layer', 'scope'])
    })
  }
}
