import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Company from './company.js'

export type CanvasPoint = { x: number; y: number }

export type CanvasWorkArea = {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
  titleFontSize?: number
}

export default class TopologyCanvasLayout extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare companyId: string

  @column()
  declare layer: 'physical' | 'logical' | 'unified'

  @column()
  declare scope: string

  @column()
  declare nodePositions: Record<string, CanvasPoint>

  @column()
  declare labelOffsets: Record<string, CanvasPoint>

  @column()
  declare workAreas: CanvasWorkArea[]

  /** deviceId → workAreaId */
  @column()
  declare nodeParents: Record<string, string>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Company)
  declare company: BelongsTo<typeof Company>
}
