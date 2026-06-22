import { randomUUID } from 'node:crypto'
import { BaseSchema } from '@adonisjs/lucid/schema'
import db from '@adonisjs/lucid/services/db'

const DEVICE_TYPE = {
  name: 'CCTV',
  icon: 'camera',
  description: 'Closed-circuit television cameras and recording equipment',
} as const

export default class extends BaseSchema {
  async up() {
    const now = new Date()
    const existing = await db.from('device_types').where('name', DEVICE_TYPE.name).first()
    if (!existing) {
      await db.table('device_types').insert({
        id: randomUUID(),
        name: DEVICE_TYPE.name,
        icon: DEVICE_TYPE.icon,
        description: DEVICE_TYPE.description,
        created_at: now,
        updated_at: now,
      })
    }
  }

  async down() {
    await db.from('device_types').where('name', DEVICE_TYPE.name).delete()
  }
}

