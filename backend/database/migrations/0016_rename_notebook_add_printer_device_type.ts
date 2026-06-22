import { randomUUID } from 'node:crypto'
import { BaseSchema } from '@adonisjs/lucid/schema'
import db from '@adonisjs/lucid/services/db'

export default class extends BaseSchema {
  async up() {
    const now = new Date()
    await db.from('device_types').where('name', 'Notebook').update({
      name: 'Notebock',
      updated_at: now,
    })

    const printer = await db.from('device_types').where('name', 'Printer').first()
    if (!printer) {
      await db.table('device_types').insert({
        id: randomUUID(),
        name: 'Printer',
        icon: 'printer',
        description: 'Network or local printer',
        created_at: now,
        updated_at: now,
      })
    }
  }

  async down() {
    await db.from('device_types').where('name', 'Printer').delete()
    const now = new Date()
    await db.from('device_types').where('name', 'Notebock').update({
      name: 'Notebook',
      updated_at: now,
    })
  }
}
