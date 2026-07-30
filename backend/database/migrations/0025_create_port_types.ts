import { BaseSchema } from '@adonisjs/lucid/schema'
import { randomUUID } from 'node:crypto'

const DEFAULT_PORT_TYPES = [
  { code: 'ethernet', name: 'Ethernet', description: 'Puerto Ethernet / RJ45' },
  { code: 'fiber', name: 'Fiber', description: 'Puerto de fibra óptica' },
  { code: 'serial', name: 'Serial', description: 'Puerto serial / consola' },
  { code: 'wireless', name: 'Wireless', description: 'Interfaz inalámbrica / SSID' },
  { code: 'wan', name: 'WAN', description: 'Enlace WAN / ISP' },
  { code: 'sfp', name: 'SFP', description: 'Puerto SFP / SFP+' },
  { code: 'coaxial', name: 'Coaxil', description: 'Puerto coaxial / coax' },
] as const

export default class extends BaseSchema {
  protected tableName = 'port_types'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.string('code', 50).notNullable().unique()
      table.string('name', 100).notNullable()
      table.text('description').nullable()
      table.timestamps(true, true)
    })

    this.defer(async (db) => {
      const now = new Date()
      for (const row of DEFAULT_PORT_TYPES) {
        await db.table(this.tableName).insert({
          id: randomUUID(),
          code: row.code,
          name: row.name,
          description: row.description,
          created_at: now,
          updated_at: now,
        })
      }

      // Convertir enum nativo a varchar para permitir tipos dinámicos
      await db.rawQuery(`
        ALTER TABLE ports
        ALTER COLUMN port_type DROP DEFAULT,
        ALTER COLUMN port_type TYPE varchar(50) USING port_type::text
      `)
      await db.rawQuery(`ALTER TABLE ports ALTER COLUMN port_type SET DEFAULT 'ethernet'`)
      await db.rawQuery(`DROP TYPE IF EXISTS ports_port_type`)
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery(`
        CREATE TYPE ports_port_type AS ENUM (
          'ethernet', 'fiber', 'serial', 'wireless', 'wan', 'sfp'
        )
      `)
      await db.rawQuery(`
        UPDATE ports
        SET port_type = 'ethernet'
        WHERE port_type NOT IN ('ethernet', 'fiber', 'serial', 'wireless', 'wan', 'sfp')
      `)
      await db.rawQuery(`
        ALTER TABLE ports
        ALTER COLUMN port_type DROP DEFAULT,
        ALTER COLUMN port_type TYPE ports_port_type USING port_type::ports_port_type
      `)
      await db.rawQuery(`ALTER TABLE ports ALTER COLUMN port_type SET DEFAULT 'ethernet'`)
    })

    this.schema.dropTable(this.tableName)
  }
}
