import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Fase 6 — Documentación adjunta polimórfica + secretos cifrados.
 * Storage de archivos: disco local (`storage/attachments/`) — ver ADR 0003.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('attachments', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('project_id')
        .notNullable()
        .references('id')
        .inTable('projects')
        .onDelete('CASCADE')
      table.string('attachable_type', 50).notNullable()
      table.uuid('attachable_id').notNullable()
      table.string('kind', 30).notNullable().defaultTo('file')
      table.string('title', 255).notNullable()
      table.text('description').nullable()
      table.string('url', 2000).nullable()
      table.string('storage_path', 500).nullable()
      table.string('mime_type', 120).nullable()
      table.bigInteger('size_bytes').nullable()
      table.string('original_filename', 255).nullable()
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
      table.index(['attachable_type', 'attachable_id'])
      table.index(['deleted_at'])
    })

    this.schema.createTable('secrets', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('project_id')
        .notNullable()
        .references('id')
        .inTable('projects')
        .onDelete('CASCADE')
      table.string('attachable_type', 50).notNullable()
      table.uuid('attachable_id').notNullable()
      table.string('kind', 30).notNullable().defaultTo('password')
      table.string('label', 255).notNullable()
      table.string('username', 255).nullable()
      table.text('value_ciphertext').notNullable()
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
      table.index(['attachable_type', 'attachable_id'])
      table.index(['deleted_at'])
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        ALTER TABLE attachments
        ADD CONSTRAINT attachments_kind_check
        CHECK (kind IN ('file','pdf','plan','photo','diagram','link','note','other'))
      `)
      await db.rawQuery(`
        ALTER TABLE attachments
        ADD CONSTRAINT attachments_attachable_type_check
        CHECK (attachable_type IN (
          'project','site','area','rack','device','connection',
          'network','vlan','device_template'
        ))
      `)
      await db.rawQuery(`
        ALTER TABLE secrets
        ADD CONSTRAINT secrets_kind_check
        CHECK (kind IN ('password','api_key','snmp','wifi','console','other'))
      `)
      await db.rawQuery(`
        ALTER TABLE secrets
        ADD CONSTRAINT secrets_attachable_type_check
        CHECK (attachable_type IN (
          'project','site','area','rack','device','connection',
          'network','vlan','device_template'
        ))
      `)
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery(`ALTER TABLE secrets DROP CONSTRAINT IF EXISTS secrets_attachable_type_check`)
      await db.rawQuery(`ALTER TABLE secrets DROP CONSTRAINT IF EXISTS secrets_kind_check`)
      await db.rawQuery(
        `ALTER TABLE attachments DROP CONSTRAINT IF EXISTS attachments_attachable_type_check`
      )
      await db.rawQuery(`ALTER TABLE attachments DROP CONSTRAINT IF EXISTS attachments_kind_check`)
    })
    this.schema.dropTable('secrets')
    this.schema.dropTable('attachments')
  }
}
