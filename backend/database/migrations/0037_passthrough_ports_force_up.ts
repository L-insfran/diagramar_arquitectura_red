import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Los puertos puente (is_passthrough) son pasivos: siempre status = up.
 * Idempotente: solo corrige filas que aún no están up.
 */
export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE ports
        SET status = 'up'
        WHERE is_passthrough = true
          AND status <> 'up'
      `)
    })
  }

  async down() {
    // No-op: no restauramos down/disabled (el estado previo no se conserva).
  }
}
