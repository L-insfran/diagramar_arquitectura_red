import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Company from './company.js'

export type CanvasPoint = { x: number; y: number }

export default class TopologyCanvasLayout extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare companyId: string

  @column()
  declare layer: 'physical' | 'logical'

  @column()
  declare scope: string

  @column()
  declare nodePositions: Record<string, CanvasPoint>

  @column()
  declare labelOffsets: Record<string, CanvasPoint>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Company)
  declare company: BelongsTo<typeof Company>
}
