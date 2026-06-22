import { randomUUID } from 'node:crypto'
import { BaseSchema } from '@adonisjs/lucid/schema'
import db from '@adonisjs/lucid/services/db'

const NEW_DEVICE_TYPES = [
  { name: 'ESXi', icon: 'box', description: 'VMware ESXi hypervisor host' },
  { name: 'Virtual Machine', icon: 'monitor', description: 'Virtual machine instance' },
  {
    name: 'Internet Service Provider',
    icon: 'cloud',
    description: 'ISP edge equipment or provider-managed CPE',
  },
  { name: 'Telephone IP', icon: 'phone', description: 'IP desk phone or softphone endpoint' },
  { name: 'Notebock', icon: 'laptop', description: 'Laptop or portable computer' },
  {
    name: 'Telephone Exchange',
    icon: 'phone-forwarded',
    description: 'PBX or telephone exchange system',
  },
] as const

export default class extends BaseSchema {
  async up() {
    const now = new Date()
    for (const row of NEW_DEVICE_TYPES) {
      const existing = await db.from('device_types').where('name', row.name).first()
      if (!existing) {
        await db.table('device_types').insert({
          id: randomUUID(),
          name: row.name,
          icon: row.icon,
          description: row.description,
          created_at: now,
          updated_at: now,
        })
      }
    }
  }

  async down() {
    await db
      .from('device_types')
      .whereIn(
        'name',
        NEW_DEVICE_TYPES.map((t) => t.name)
      )
      .delete()
  }
}
