import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      await db.rawQuery(`
        ALTER TABLE ports ALTER COLUMN status SET DEFAULT 'up'
      `)
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery(`
        ALTER TABLE ports ALTER COLUMN status SET DEFAULT 'down'
      `)
    })
  }
}
