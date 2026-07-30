import { BaseSchema } from '@adonisjs/lucid/schema'
import { randomUUID } from 'node:crypto'

const PORT_TYPE_DEFAULTS: Record<
  string,
  { defaultSpeed: string | null; color: string; icon: string; direction: string }
> = {
  ethernet: { defaultSpeed: '1G', color: '#22c55e', icon: 'ethernet', direction: 'bidirectional' },
  fiber: { defaultSpeed: '10G', color: '#f59e0b', icon: 'fiber', direction: 'bidirectional' },
  serial: { defaultSpeed: null, color: '#94a3b8', icon: 'serial', direction: 'bidirectional' },
  wireless: { defaultSpeed: null, color: '#38bdf8', icon: 'wifi', direction: 'bidirectional' },
  wan: { defaultSpeed: null, color: '#a78bfa', icon: 'wan', direction: 'bidirectional' },
  sfp: { defaultSpeed: '10G', color: '#f97316', icon: 'sfp', direction: 'bidirectional' },
  coaxial: { defaultSpeed: null, color: '#78716c', icon: 'coaxial', direction: 'bidirectional' },
}

const CABLE_TYPE_SEEDS = [
  {
    code: 'utp-cat5e',
    name: 'UTP Cat5e',
    description: 'Cable UTP categoría 5e',
    mediumFamily: 'utp',
    defaultCategory: '5e',
    defaultFiberType: null as string | null,
    color: '#22c55e',
    sortOrder: 10,
  },
  {
    code: 'utp-cat6',
    name: 'UTP Cat6',
    description: 'Cable UTP categoría 6',
    mediumFamily: 'utp',
    defaultCategory: '6',
    defaultFiberType: null,
    color: '#16a34a',
    sortOrder: 20,
  },
  {
    code: 'utp-cat6a',
    name: 'UTP Cat6A',
    description: 'Cable UTP categoría 6A',
    mediumFamily: 'utp',
    defaultCategory: '6a',
    defaultFiberType: null,
    color: '#15803d',
    sortOrder: 30,
  },
  {
    code: 'fiber-mm',
    name: 'Fibra multimodo',
    description: 'Fibra óptica multimodo (MM)',
    mediumFamily: 'fiber',
    defaultCategory: null,
    defaultFiberType: 'multimode',
    color: '#f59e0b',
    sortOrder: 40,
  },
  {
    code: 'fiber-sm',
    name: 'Fibra monomodo',
    description: 'Fibra óptica monomodo (SM)',
    mediumFamily: 'fiber',
    defaultCategory: null,
    defaultFiberType: 'singlemode',
    color: '#ea580c',
    sortOrder: 50,
  },
  {
    code: 'dac',
    name: 'DAC',
    description: 'Direct Attach Copper',
    mediumFamily: 'other',
    defaultCategory: null,
    defaultFiberType: null,
    color: '#64748b',
    sortOrder: 60,
  },
  {
    code: 'console',
    name: 'Console',
    description: 'Cable de consola / serial',
    mediumFamily: 'console',
    defaultCategory: null,
    defaultFiberType: null,
    color: '#94a3b8',
    sortOrder: 70,
  },
  {
    code: 'power',
    name: 'Power',
    description: 'Cable de alimentación',
    mediumFamily: 'power',
    defaultCategory: null,
    defaultFiberType: null,
    color: '#ef4444',
    sortOrder: 80,
  },
  {
    code: 'coaxial',
    name: 'Coaxial',
    description: 'Cable coaxial',
    mediumFamily: 'other',
    defaultCategory: null,
    defaultFiberType: null,
    color: '#78716c',
    sortOrder: 90,
  },
  {
    code: 'wifi',
    name: 'WiFi',
    description: 'Enlace inalámbrico',
    mediumFamily: 'wifi',
    defaultCategory: null,
    defaultFiberType: null,
    color: '#38bdf8',
    sortOrder: 100,
  },
  {
    code: 'internet-wan',
    name: 'Internet / WAN',
    description: 'Enlace WAN / ISP',
    mediumFamily: 'internet',
    defaultCategory: null,
    defaultFiberType: null,
    color: '#a78bfa',
    sortOrder: 110,
  },
  {
    code: 'other',
    name: 'Otros',
    description: 'Otro medio',
    mediumFamily: 'other',
    defaultCategory: null,
    defaultFiberType: null,
    color: '#6b7280',
    sortOrder: 200,
  },
] as const

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('port_types', (table) => {
      table.string('default_speed', 50).nullable()
      table.string('color', 20).nullable()
      table.string('icon', 50).nullable()
      table.string('direction', 20).notNullable().defaultTo('bidirectional')
    })

    this.schema.createTable('cable_types', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.string('code', 50).notNullable().unique()
      table.string('name', 100).notNullable()
      table.text('description').nullable()
      table.string('medium_family', 20).notNullable()
      table.string('default_category', 10).nullable()
      table.string('default_fiber_type', 20).nullable()
      table.string('color', 20).nullable()
      table.integer('sort_order').notNullable().defaultTo(100)
      table.timestamps(true, true)
    })

    this.schema.alterTable('connections', (table) => {
      table
        .uuid('cable_type_id')
        .nullable()
        .references('id')
        .inTable('cable_types')
        .onDelete('SET NULL')
      table.index(['cable_type_id'])
    })

    this.defer(async (db) => {
      const now = new Date()
      const portTypes = (await db.from('port_types').select('id', 'code')) as Array<{
        id: string
        code: string
      }>
      for (const pt of portTypes) {
        const defaults = PORT_TYPE_DEFAULTS[pt.code] ?? {
          defaultSpeed: null,
          color: '#6b7280',
          icon: 'cable',
          direction: 'bidirectional',
        }
        await db.from('port_types').where('id', pt.id).update({
          default_speed: defaults.defaultSpeed,
          color: defaults.color,
          icon: defaults.icon,
          direction: defaults.direction,
        })
      }

      for (const seed of CABLE_TYPE_SEEDS) {
        await db.table('cable_types').insert({
          id: randomUUID(),
          code: seed.code,
          name: seed.name,
          description: seed.description,
          medium_family: seed.mediumFamily,
          default_category: seed.defaultCategory,
          default_fiber_type: seed.defaultFiberType,
          color: seed.color,
          sort_order: seed.sortOrder,
          created_at: now,
          updated_at: now,
        })
      }

      // Soft-delete older duplicate physical links so unique-ish occupancy is clean
      const active = (await db
        .from('connections')
        .whereNull('deleted_at')
        .where('connection_type', 'physical')
        .select('id', 'source_port_id', 'target_port_id', 'created_at')
        .orderBy('created_at', 'asc')) as Array<{
        id: string
        source_port_id: string
        target_port_id: string
        created_at: Date | string
      }>

      const seenPorts = new Set<string>()
      for (const row of active) {
        const ports = [row.source_port_id, row.target_port_id]
        const conflict = ports.some((p) => seenPorts.has(p))
        if (conflict) {
          await db.from('connections').where('id', row.id).update({
            deleted_at: now,
            updated_at: now,
          })
          continue
        }
        for (const p of ports) seenPorts.add(p)
      }

      await db.rawQuery(`
        CREATE UNIQUE INDEX IF NOT EXISTS connections_source_port_active_uidx
        ON connections (source_port_id)
        WHERE deleted_at IS NULL AND connection_type = 'physical'
      `)
      await db.rawQuery(`
        CREATE UNIQUE INDEX IF NOT EXISTS connections_target_port_active_uidx
        ON connections (target_port_id)
        WHERE deleted_at IS NULL AND connection_type = 'physical'
      `)
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery(`DROP INDEX IF EXISTS connections_target_port_active_uidx`)
      await db.rawQuery(`DROP INDEX IF EXISTS connections_source_port_active_uidx`)
    })

    this.schema.alterTable('connections', (table) => {
      table.dropIndex(['cable_type_id'])
      table.dropColumn('cable_type_id')
    })
    this.schema.dropTable('cable_types')
    this.schema.alterTable('port_types', (table) => {
      table.dropColumn('direction')
      table.dropColumn('icon')
      table.dropColumn('color')
      table.dropColumn('default_speed')
    })
  }
}
