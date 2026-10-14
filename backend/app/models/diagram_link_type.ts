import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Project from './project.js'

export type DiagramLinkLineStyle =
  | 'solid'
  | 'long_dash'
  | 'short_dash'
  | 'dotted'
  | 'dash_dot'
  | 'dash_dot_dot'

export default class DiagramLinkType extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare projectId: string

  @column()
  declare name: string

  @column()
  declare color: string

  @column()
  declare lineStyle: DiagramLinkLineStyle

  @column()
  declare description: string | null

  @column()
  declare sortOrder: number

  @column()
  declare isDefault: boolean

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
}
