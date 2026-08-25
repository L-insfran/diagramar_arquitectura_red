import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'connection_diagrams'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .jsonb('tree_layout')
        .notNullable()
        .defaultTo(this.raw(`'{}'::jsonb`))
    })

    // Diagrams currently in tree mode have absolute tree coordinates in the
    // free-layout columns. Move them into tree_layout and clear the free columns
    // so switching back to free restacks cleanly inside containers.
    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE connection_diagrams
        SET tree_layout = jsonb_build_object(
              'nodePositions', COALESCE(node_positions, '{}'::jsonb),
              'edgeRoutes', COALESCE(edge_routes, '{}'::jsonb),
              'labelOffsets', COALESCE(label_offsets, '{}'::jsonb),
              'handleAnchors', COALESCE(handle_anchors, '{}'::jsonb)
            ),
            node_positions = '{}'::jsonb,
            edge_routes = '{}'::jsonb,
            label_offsets = '{}'::jsonb,
            handle_anchors = '{}'::jsonb
        WHERE layout_mode = 'tree'
      `)
    })
  }

  async down() {
    this.defer(async (db) => {
      // Best-effort restore: diagrams in tree mode get geometry back into free columns.
      await db.rawQuery(`
        UPDATE connection_diagrams
        SET node_positions = COALESCE(tree_layout->'nodePositions', '{}'::jsonb),
            edge_routes = COALESCE(tree_layout->'edgeRoutes', '{}'::jsonb),
            label_offsets = COALESCE(tree_layout->'labelOffsets', '{}'::jsonb),
            handle_anchors = COALESCE(tree_layout->'handleAnchors', '{}'::jsonb)
        WHERE layout_mode = 'tree'
          AND tree_layout IS NOT NULL
          AND tree_layout <> '{}'::jsonb
      `)
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('tree_layout')
    })
  }
}
