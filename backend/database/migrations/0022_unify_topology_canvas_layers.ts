import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'topology_canvas_layouts'

  async up() {
    // Keep the physical layout (already arranged by users) as the unified layout
    this.defer(async (db) => {
      await db.from(this.tableName).where('layer', 'physical').update({ layer: 'unified' })
      await db.from(this.tableName).where('layer', 'logical').delete()
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.from(this.tableName).where('layer', 'unified').update({ layer: 'physical' })
    })
  }
}
