import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Project from './project.js'
import Area from './area.js'
import Device from './device.js'
import RackAccessory from './rack_accessory.js'

export type ContainerKind = 'default' | 'rack' | 'board'
export type BoardKind = 'electrical' | 'communications' | 'generic'

export default class Container extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare projectId: string

  @column()
  declare areaId: string

  @column()
  declare kind: ContainerKind

  @column()
  declare name: string

  @column()
  declare code: string | null

  @column()
  declare manufacturer: string | null

  @column()
  declare model: string | null

  @column()
  declare notes: string | null

  @column()
  declare heightU: number | null

  @column()
  declare boardKind: BoardKind | null

  @column()
  declare gridRows: number | null

  @column()
  declare gridCols: number | null

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

  @hasMany(() => Device, { foreignKey: 'containerId' })
  declare devices: HasMany<typeof Device>

  @hasMany(() => RackAccessory, { foreignKey: 'containerId' })
  declare accessories: HasMany<typeof RackAccessory>
}
