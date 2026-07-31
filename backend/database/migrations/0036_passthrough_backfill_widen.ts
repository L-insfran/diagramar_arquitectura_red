import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Amplía el backfill de is_passthrough: device type "Ethernet",
 * y templates cuyo nombre/modelo sugiera patch panel / patchera.
 * Idempotente y aditivo (nunca desmarca).
 */
export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE ports
        SET is_passthrough = true
        WHERE is_passthrough = false
          AND device_id IN (
            SELECT d.id
            FROM devices d
            INNER JOIN device_types dt ON dt.id = d.device_type_id
            WHERE LOWER(dt.name) LIKE '%patch%'
               OR LOWER(dt.name) LIKE '%cableado estructurado%'
               OR LOWER(dt.name) = 'ethernet'
          )
      `)

      await db.rawQuery(`
        UPDATE ports
        SET is_passthrough = true
        WHERE is_passthrough = false
          AND device_id IN (
            SELECT d.id
            FROM devices d
            INNER JOIN device_templates t ON t.id = d.device_template_id
            WHERE t.deleted_at IS NULL
              AND (
                LOWER(t.name) LIKE '%patch panel%'
                OR LOWER(t.name) LIKE '%patchera%'
                OR LOWER(t.name) LIKE '%panel de parcheo%'
                OR LOWER(COALESCE(t.model, '')) LIKE '%patch panel%'
                OR LOWER(COALESCE(t.model, '')) LIKE '%patchera%'
                OR LOWER(COALESCE(t.model, '')) LIKE '%panel de parcheo%'
              )
          )
      `)

      await db.rawQuery(`
        UPDATE device_template_ports
        SET is_passthrough = true
        WHERE is_passthrough = false
          AND device_template_id IN (
            SELECT t.id
            FROM device_templates t
            INNER JOIN device_types dt ON dt.id = t.device_type_id
            WHERE t.deleted_at IS NULL
              AND (
                LOWER(dt.name) LIKE '%patch%'
                OR LOWER(dt.name) LIKE '%cableado estructurado%'
                OR LOWER(dt.name) = 'ethernet'
              )
          )
      `)

      await db.rawQuery(`
        UPDATE device_template_ports
        SET is_passthrough = true
        WHERE is_passthrough = false
          AND device_template_id IN (
            SELECT t.id
            FROM device_templates t
            WHERE t.deleted_at IS NULL
              AND (
                LOWER(t.name) LIKE '%patch panel%'
                OR LOWER(t.name) LIKE '%patchera%'
                OR LOWER(t.name) LIKE '%panel de parcheo%'
                OR LOWER(COALESCE(t.model, '')) LIKE '%patch panel%'
                OR LOWER(COALESCE(t.model, '')) LIKE '%patchera%'
                OR LOWER(COALESCE(t.model, '')) LIKE '%panel de parcheo%'
              )
          )
      `)
    })
  }

  async down() {
    // No-op: no desmarcamos puertos (el flag es editable y puede ser intencional).
  }
}
