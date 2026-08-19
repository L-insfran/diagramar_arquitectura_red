import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      // Deduplicate: if any area has multiple active default containers,
      // move all devices to the oldest one and soft-delete the rest.
      await db.rawQuery(`
        WITH ranked AS (
          SELECT id, area_id,
                 ROW_NUMBER() OVER (PARTITION BY area_id ORDER BY created_at ASC) AS rn
          FROM containers
          WHERE kind = 'default' AND deleted_at IS NULL
        ),
        keeper AS (
          SELECT area_id, id AS keeper_id FROM ranked WHERE rn = 1
        ),
        duplicate AS (
          SELECT r.id AS dup_id, k.keeper_id
          FROM ranked r
          JOIN keeper k ON k.area_id = r.area_id
          WHERE r.rn > 1
        )
        UPDATE devices
        SET container_id = d.keeper_id, updated_at = NOW()
        FROM duplicate d
        WHERE devices.container_id = d.dup_id
      `)

      await db.rawQuery(`
        WITH ranked AS (
          SELECT id, area_id,
                 ROW_NUMBER() OVER (PARTITION BY area_id ORDER BY created_at ASC) AS rn
          FROM containers
          WHERE kind = 'default' AND deleted_at IS NULL
        )
        UPDATE containers
        SET deleted_at = NOW(), deleted_by = updated_by
        FROM ranked
        WHERE containers.id = ranked.id AND ranked.rn > 1
      `)
    })

    this.schema.raw(`
      CREATE UNIQUE INDEX containers_area_default_uidx
      ON containers (area_id)
      WHERE kind = 'default' AND deleted_at IS NULL
    `)
  }

  async down() {
    this.schema.raw(`DROP INDEX IF EXISTS containers_area_default_uidx`)
  }
}
