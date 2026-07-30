import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Project from './project.js'
import Area from './area.js'
import Device from './device.js'

export default class Rack extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare projectId: string

  @column()
  declare areaId: string

  @column()
  declare name: string

  @column()
  declare code: string | null

  @column()
  declare heightU: number

  @column()
  declare manufacturer: string | null

  @column()
  declare model: string | null

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

  @belongsTo(() => Project)
  declare project: BelongsTo<typeof Project>

  @belongsTo(() => Area)
  declare area: BelongsTo<typeof Area>

  @hasMany(() => Device)
  declare devices: HasMany<typeof Device>
}
