import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Project from './project.js'

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

function parseJsonObject<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as T) : fallback
    } catch {
      return fallback
    }
  }
  if (typeof value === 'object' && !Array.isArray(value)) return value as T
  return fallback
}

function parseJsonArray<T>(value: unknown): T[] {
  if (value == null) return []
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown
      return Array.isArray(parsed) ? (parsed as T[]) : []
    } catch {
      return []
    }
  }
  return Array.isArray(value) ? (value as T[]) : []
}

export default class TopologyCanvasLayout extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare projectId: string

  @column()
  declare layer: 'physical' | 'logical' | 'unified'

  @column()
  declare scope: string

  @column({
    prepare: (value: Record<string, CanvasPoint> | null) => JSON.stringify(value ?? {}),
    consume: (value: unknown) => parseJsonObject<Record<string, CanvasPoint>>(value, {}),
  })
  declare nodePositions: Record<string, CanvasPoint>

  @column({
    prepare: (value: Record<string, CanvasPoint> | null) => JSON.stringify(value ?? {}),
    consume: (value: unknown) => parseJsonObject<Record<string, CanvasPoint>>(value, {}),
  })
  declare labelOffsets: Record<string, CanvasPoint>

  /**
   * Array JSON. Sin prepare, node-pg serializa JS arrays como arrays SQL
   * (`{...}`) y PostgreSQL rechaza el valor en columnas jsonb.
   */
  @column({
    prepare: (value: CanvasWorkArea[] | null) => JSON.stringify(Array.isArray(value) ? value : []),
    consume: (value: unknown) => parseJsonArray<CanvasWorkArea>(value),
  })
  declare workAreas: CanvasWorkArea[]

  /** deviceId → workAreaId */
  @column({
    prepare: (value: Record<string, string> | null) => JSON.stringify(value ?? {}),
    consume: (value: unknown) => parseJsonObject<Record<string, string>>(value, {}),
  })
  declare nodeParents: Record<string, string>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Project)
  declare project: BelongsTo<typeof Project>
}
