import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      // 1. Copy racks → containers (preserving UUIDs)
      await db.rawQuery(`
        INSERT INTO containers (id, project_id, area_id, kind, name, code, manufacturer, model, notes, height_u, created_by, updated_by, deleted_by, created_at, updated_at, deleted_at)
        SELECT id, project_id, area_id, 'rack', name, code, manufacturer, model, notes, height_u, created_by, updated_by, deleted_by, created_at, updated_at, deleted_at
        FROM racks
      `)

      // 2. Copy boards → containers (preserving UUIDs)
      await db.rawQuery(`
        INSERT INTO containers (id, project_id, area_id, kind, name, code, manufacturer, model, notes, board_kind, grid_rows, grid_cols, created_by, updated_by, deleted_by, created_at, updated_at, deleted_at)
        SELECT id, project_id, area_id, 'board', name, code, manufacturer, model, notes, kind, grid_rows, grid_cols, created_by, updated_by, deleted_by, created_at, updated_at, deleted_at
        FROM boards
      `)

      // 3. Create default containers for areas that have loose devices (no rack/board)
      await db.rawQuery(`
        INSERT INTO containers (project_id, area_id, kind, name)
        SELECT DISTINCT d.project_id, d.area_id, 'default', 'General'
        FROM devices d
        WHERE d.area_id IS NOT NULL
          AND d.rack_id IS NULL
          AND d.board_id IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM containers c
            WHERE c.area_id = d.area_id AND c.kind = 'default'
          )
      `)

      // 4. Add container_id to devices
      await db.rawQuery(`ALTER TABLE devices ADD COLUMN container_id UUID REFERENCES containers(id) ON DELETE SET NULL`)

      // 5. Populate container_id from rack_id
      await db.rawQuery(`UPDATE devices SET container_id = rack_id WHERE rack_id IS NOT NULL`)

      // 6. Populate container_id from board_id
      await db.rawQuery(`UPDATE devices SET container_id = board_id WHERE board_id IS NOT NULL`)

      // 7. Populate container_id for loose devices → default container of their area
      await db.rawQuery(`
        UPDATE devices d
        SET container_id = c.id
        FROM containers c
        WHERE d.area_id IS NOT NULL
          AND d.rack_id IS NULL
          AND d.board_id IS NULL
          AND d.container_id IS NULL
          AND c.area_id = d.area_id
          AND c.kind = 'default'
      `)

      // 8. Add container_id to rack_accessories
      await db.rawQuery(`ALTER TABLE rack_accessories ADD COLUMN container_id UUID REFERENCES containers(id) ON DELETE CASCADE`)
      await db.rawQuery(`UPDATE rack_accessories SET container_id = rack_id`)

      // 9. Migrate connection_diagrams.containers JSON keys: rack:{id} → container:{id}, board:{id} → container:{id}
      await db.rawQuery(`
        UPDATE connection_diagrams
        SET containers = (
          SELECT jsonb_object_agg(
            CASE
              WHEN key LIKE 'rack:%' THEN 'container:' || substring(key FROM 6)
              WHEN key LIKE 'board:%' THEN 'container:' || substring(key FROM 7)
              ELSE key
            END,
            CASE
              WHEN (value->>'parentId') LIKE 'rack:%' THEN jsonb_set(value, '{parentId}', to_jsonb('container:' || substring(value->>'parentId' FROM 6)))
              WHEN (value->>'parentId') LIKE 'board:%' THEN jsonb_set(value, '{parentId}', to_jsonb('container:' || substring(value->>'parentId' FROM 7)))
              ELSE value
            END
          )
          FROM jsonb_each(containers)
        )
        WHERE containers IS NOT NULL AND containers::text <> '{}'
      `)

      // 10. Migrate edge_routes keys similarly
      await db.rawQuery(`
        UPDATE connection_diagrams
        SET edge_routes = (
          SELECT jsonb_object_agg(key, value)
          FROM jsonb_each(edge_routes)
        )
        WHERE edge_routes IS NOT NULL AND edge_routes::text <> '{}'
      `)
    })

    // Create index on devices.container_id
    this.schema.alterTable('devices', (table) => {
      table.index(['container_id'])
    })

    this.schema.alterTable('rack_accessories', (table) => {
      table.index(['container_id'])
    })
  }

  async down() {
    this.defer(async (db) => {
      // Reverse: restore rack_id/board_id from container_id based on container kind
      await db.rawQuery(`
        UPDATE connection_diagrams
        SET containers = (
          SELECT jsonb_object_agg(
            CASE
              WHEN key LIKE 'container:%' THEN
                CASE
                  WHEN EXISTS (SELECT 1 FROM racks WHERE id::text = substring(key FROM 11))
                    THEN 'rack:' || substring(key FROM 11)
                  WHEN EXISTS (SELECT 1 FROM boards WHERE id::text = substring(key FROM 11))
                    THEN 'board:' || substring(key FROM 11)
                  ELSE key
                END
              ELSE key
            END,
            value
          )
          FROM jsonb_each(containers)
        )
        WHERE containers IS NOT NULL AND containers::text <> '{}'
      `)

      await db.rawQuery(`ALTER TABLE rack_accessories DROP COLUMN IF EXISTS container_id`)
      await db.rawQuery(`ALTER TABLE devices DROP COLUMN IF EXISTS container_id`)
    })
  }
}
