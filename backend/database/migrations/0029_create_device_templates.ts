import { BaseSchema } from '@adonisjs/lucid/schema'
import { randomUUID } from 'node:crypto'

type DeviceRow = {
  id: string
  project_id: string
  device_type_id: string
  manufacturer: string | null
  model: string | null
  deleted_at: Date | string | null
  created_at: Date | string
}

type PortRow = {
  device_id: string
  name: string
  port_number: number
  port_type: string
  speed: string | null
  description: string | null
}

type DeviceTypeRow = {
  id: string
  name: string
}

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function groupKey(row: DeviceRow): string {
  return [
    row.project_id,
    row.device_type_id,
    normalize(row.manufacturer),
    normalize(row.model),
  ].join('|')
}

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('device_templates', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('project_id')
        .notNullable()
        .references('id')
        .inTable('projects')
        .onDelete('CASCADE')
      table
        .uuid('device_type_id')
        .notNullable()
        .references('id')
        .inTable('device_types')
        .onDelete('RESTRICT')
      table.string('name', 255).notNullable()
      table.string('manufacturer', 255).nullable()
      table.string('model', 255).nullable()
      table.integer('rack_units').nullable()
      table.string('image_url', 500).nullable()
      table.string('front_view_url', 500).nullable()
      table.string('rear_view_url', 500).nullable()
      table.decimal('power_consumption_w', 10, 2).nullable()
      table.decimal('weight_kg', 10, 2).nullable()
      table.jsonb('custom_fields').notNullable().defaultTo(this.raw(`'{}'::jsonb`))
      table.text('notes').nullable()
      table
        .uuid('created_by')
        .nullable()
        .references('id')
        .inTable('system_users')
        .onDelete('SET NULL')
      table
        .uuid('updated_by')
        .nullable()
        .references('id')
        .inTable('system_users')
        .onDelete('SET NULL')
      table
        .uuid('deleted_by')
        .nullable()
        .references('id')
        .inTable('system_users')
        .onDelete('SET NULL')
      table.timestamp('deleted_at', { useTz: true }).nullable()
      table.timestamps(true, true)
      table.index(['project_id'])
      table.index(['deleted_at'])
      table.index(['project_id', 'manufacturer', 'model'])
    })

    this.schema.createTable('device_template_ports', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('device_template_id')
        .notNullable()
        .references('id')
        .inTable('device_templates')
        .onDelete('CASCADE')
      table.string('name', 100).notNullable()
      table.integer('port_number').notNullable()
      table.string('port_type', 50).notNullable().defaultTo('ethernet')
      table.string('speed', 50).nullable()
      table.text('description').nullable()
      table.timestamps(true, true)
      table.index(['device_template_id'])
    })

    this.schema.alterTable('devices', (table) => {
      table.uuid('device_template_id').nullable()
    })

    this.defer(async (db) => {
      const now = new Date()
      const devices = (await db.from('devices').select('*')) as DeviceRow[]
      const ports = (await db.from('ports').select('*')) as PortRow[]
      const deviceTypes = (await db.from('device_types').select('id', 'name')) as DeviceTypeRow[]
      const typeNameById = new Map(deviceTypes.map((t) => [t.id, t.name]))

      const portsByDevice = new Map<string, PortRow[]>()
      for (const port of ports) {
        const list = portsByDevice.get(port.device_id) ?? []
        list.push(port)
        portsByDevice.set(port.device_id, list)
      }

      const groups = new Map<string, DeviceRow[]>()
      for (const device of devices) {
        const key = groupKey(device)
        const list = groups.get(key) ?? []
        list.push(device)
        groups.set(key, list)
      }

      /** Fallback generic template per (project, device_type) for orphan soft-deleted edge cases. */
      const genericTemplateByProjectType = new Map<string, string>()

      for (const [, groupDevices] of groups) {
        const sample = groupDevices[0]
        const typeName = typeNameById.get(sample.device_type_id) ?? 'Device'
        const mfr = (sample.manufacturer ?? '').trim()
        const mdl = (sample.model ?? '').trim()
        const hasIdentity = Boolean(mfr || mdl)
        const templateName = hasIdentity
          ? [mfr, mdl].filter(Boolean).join(' ')
          : `Generic ${typeName}`

        const canonical = [...groupDevices].sort((a, b) => {
          const portsA = portsByDevice.get(a.id)?.length ?? 0
          const portsB = portsByDevice.get(b.id)?.length ?? 0
          if (portsB !== portsA) return portsB - portsA
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        })[0]

        const templateId = randomUUID()
        await db.table('device_templates').insert({
          id: templateId,
          project_id: sample.project_id,
          device_type_id: sample.device_type_id,
          name: templateName.slice(0, 255),
          manufacturer: mfr || null,
          model: mdl || null,
          rack_units: null,
          image_url: null,
          front_view_url: null,
          rear_view_url: null,
          power_consumption_w: null,
          weight_kg: null,
          custom_fields: JSON.stringify({}),
          notes: null,
          created_by: null,
          updated_by: null,
          deleted_by: null,
          deleted_at: null,
          created_at: now,
          updated_at: now,
        })

        if (!hasIdentity) {
          genericTemplateByProjectType.set(
            `${sample.project_id}|${sample.device_type_id}`,
            templateId
          )
        }

        const canonicalPorts = [...(portsByDevice.get(canonical.id) ?? [])].sort(
          (a, b) => a.port_number - b.port_number
        )
        for (const port of canonicalPorts) {
          await db.table('device_template_ports').insert({
            id: randomUUID(),
            device_template_id: templateId,
            name: port.name,
            port_number: port.port_number,
            port_type: port.port_type || 'ethernet',
            speed: port.speed,
            description: port.description,
            created_at: now,
            updated_at: now,
          })
        }

        for (const device of groupDevices) {
          await db.from('devices').where('id', device.id).update({
            device_template_id: templateId,
          })
        }
      }

      // Safety: any device still without template (should not happen) gets a generic one
      const orphans = (await db
        .from('devices')
        .whereNull('device_template_id')
        .select('*')) as DeviceRow[]

      for (const device of orphans) {
        const mapKey = `${device.project_id}|${device.device_type_id}`
        let templateId = genericTemplateByProjectType.get(mapKey)
        if (!templateId) {
          const typeName = typeNameById.get(device.device_type_id) ?? 'Device'
          templateId = randomUUID()
          await db.table('device_templates').insert({
            id: templateId,
            project_id: device.project_id,
            device_type_id: device.device_type_id,
            name: `Generic ${typeName}`.slice(0, 255),
            manufacturer: null,
            model: null,
            rack_units: null,
            image_url: null,
            front_view_url: null,
            rear_view_url: null,
            power_consumption_w: null,
            weight_kg: null,
            custom_fields: JSON.stringify({}),
            notes: null,
            created_by: null,
            updated_by: null,
            deleted_by: null,
            deleted_at: null,
            created_at: now,
            updated_at: now,
          })
          genericTemplateByProjectType.set(mapKey, templateId)
        }
        await db.from('devices').where('id', device.id).update({
          device_template_id: templateId,
        })
      }

      await db.rawQuery(`
        ALTER TABLE devices
        ALTER COLUMN device_template_id SET NOT NULL
      `)
      await db.rawQuery(`
        ALTER TABLE devices
        ADD CONSTRAINT devices_device_template_id_foreign
        FOREIGN KEY (device_template_id)
        REFERENCES device_templates(id)
        ON DELETE RESTRICT
      `)
      await db.rawQuery(`
        CREATE INDEX devices_device_template_id_index ON devices (device_template_id)
      `)
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery(`DROP INDEX IF EXISTS devices_device_template_id_index`)
      await db.rawQuery(`
        ALTER TABLE devices
        DROP CONSTRAINT IF EXISTS devices_device_template_id_foreign
      `)
    })

    this.schema.alterTable('devices', (table) => {
      table.dropColumn('device_template_id')
    })
    this.schema.dropTable('device_template_ports')
    this.schema.dropTable('device_templates')
  }
}
