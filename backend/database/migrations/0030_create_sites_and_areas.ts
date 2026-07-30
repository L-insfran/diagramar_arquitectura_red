import { BaseSchema } from '@adonisjs/lucid/schema'
import { randomUUID } from 'node:crypto'

type DeviceLocRow = {
  id: string
  project_id: string
  location: string | null
}

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('sites', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('project_id')
        .notNullable()
        .references('id')
        .inTable('projects')
        .onDelete('CASCADE')
      table.string('name', 255).notNullable()
      table.string('address', 500).nullable()
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
    })

    this.schema.createTable('areas', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('site_id')
        .notNullable()
        .references('id')
        .inTable('sites')
        .onDelete('CASCADE')
      table.string('name', 255).notNullable()
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
      table.index(['site_id'])
      table.index(['deleted_at'])
    })

    this.schema.alterTable('devices', (table) => {
      table
        .uuid('site_id')
        .nullable()
        .references('id')
        .inTable('sites')
        .onDelete('SET NULL')
      table
        .uuid('area_id')
        .nullable()
        .references('id')
        .inTable('areas')
        .onDelete('SET NULL')
      table.index(['site_id'])
      table.index(['area_id'])
    })

    this.defer(async (db) => {
      const now = new Date()
      const devices = (await db
        .from('devices')
        .whereNotNull('location')
        .select('id', 'project_id', 'location')) as DeviceLocRow[]

      const byProject = new Map<string, DeviceLocRow[]>()
      for (const device of devices) {
        const loc = (device.location ?? '').trim()
        if (!loc) continue
        const list = byProject.get(device.project_id) ?? []
        list.push({ ...device, location: loc })
        byProject.set(device.project_id, list)
      }

      for (const [projectId, projectDevices] of byProject) {
        const siteId = randomUUID()
        await db.table('sites').insert({
          id: siteId,
          project_id: projectId,
          name: 'Sin clasificar',
          address: null,
          notes: 'Sitio creado automáticamente desde ubicaciones de texto legacy',
          created_by: null,
          updated_by: null,
          deleted_by: null,
          deleted_at: null,
          created_at: now,
          updated_at: now,
        })

        const areaByNormalized = new Map<string, string>()
        for (const device of projectDevices) {
          const name = (device.location ?? '').trim().slice(0, 255)
          const key = name.toLowerCase()
          let areaId = areaByNormalized.get(key)
          if (!areaId) {
            areaId = randomUUID()
            await db.table('areas').insert({
              id: areaId,
              site_id: siteId,
              name,
              notes: null,
              created_by: null,
              updated_by: null,
              deleted_by: null,
              deleted_at: null,
              created_at: now,
              updated_at: now,
            })
            areaByNormalized.set(key, areaId)
          }
          await db.from('devices').where('id', device.id).update({
            site_id: siteId,
            area_id: areaId,
          })
        }
      }
    })
  }

  async down() {
    this.schema.alterTable('devices', (table) => {
      table.dropIndex(['area_id'])
      table.dropIndex(['site_id'])
      table.dropColumn('area_id')
      table.dropColumn('site_id')
    })
    this.schema.dropTable('areas')
    this.schema.dropTable('sites')
  }
}
