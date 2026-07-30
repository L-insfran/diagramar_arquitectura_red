import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Site from './site.js'
import Device from './device.js'

export default class Area extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare siteId: string

  @column()
  declare name: string

  @column()
  declare notes: string | null

  @column()
  declare createdBy: string | null

  @column()
  declare updatedBy: string | null

  @column()
  declare deletedBy: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @column.dateTime()
  declare deletedAt: DateTime | null

  @belongsTo(() => Site)
  declare site: BelongsTo<typeof Site>

  @hasMany(() => Device)
  declare devices: HasMany<typeof Device>
}
