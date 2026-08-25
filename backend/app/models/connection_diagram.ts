import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Project from './project.js'
import type {
  DiagramContainerState,
  DiagramEdgeRoute,
  DiagramHandleAnchor,
  DiagramLayoutMode,
  DiagramLayoutState,
  DiagramPoint,
  DiagramSettings,
} from '#dtos/connection_diagram_dto'

function parseJsonObject<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as T)
        : fallback
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

export default class ConnectionDiagram extends BaseModel {
  static table = 'connection_diagrams'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare projectId: string

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column({
    prepare: (value: string[] | null) => JSON.stringify(Array.isArray(value) ? value : []),
    consume: (value: unknown) => parseJsonArray<string>(value),
  })
  declare scopeSiteIds: string[]

  @column({
    prepare: (value: string[] | null) => JSON.stringify(Array.isArray(value) ? value : []),
    consume: (value: unknown) => parseJsonArray<string>(value),
  })
  declare scopeAreaIds: string[]

  @column({
    prepare: (value: Record<string, DiagramPoint> | null) => JSON.stringify(value ?? {}),
    consume: (value: unknown) => parseJsonObject<Record<string, DiagramPoint>>(value, {}),
  })
  declare nodePositions: Record<string, DiagramPoint>

  @column({
    prepare: (value: Record<string, DiagramPoint> | null) => JSON.stringify(value ?? {}),
    consume: (value: unknown) => parseJsonObject<Record<string, DiagramPoint>>(value, {}),
  })
  declare labelOffsets: Record<string, DiagramPoint>

  @column({
    prepare: (value: Record<string, DiagramEdgeRoute> | null) => JSON.stringify(value ?? {}),
    consume: (value: unknown) => parseJsonObject<Record<string, DiagramEdgeRoute>>(value, {}),
  })
  declare edgeRoutes: Record<string, DiagramEdgeRoute>

  @column({
    prepare: (value: Record<string, DiagramContainerState> | null) => JSON.stringify(value ?? {}),
    consume: (value: unknown) => parseJsonObject<Record<string, DiagramContainerState>>(value, {}),
  })
  declare containers: Record<string, DiagramContainerState>

  @column({
    prepare: (value: Record<string, DiagramHandleAnchor> | null) => JSON.stringify(value ?? {}),
    consume: (value: unknown) =>
      parseJsonObject<Record<string, DiagramHandleAnchor>>(value, {}),
  })
  declare handleAnchors: Record<string, DiagramHandleAnchor>

  @column({
    prepare: (value: DiagramLayoutState | null) => JSON.stringify(value ?? {}),
    consume: (value: unknown) => parseJsonObject<DiagramLayoutState>(value, {}),
  })
  declare treeLayout: DiagramLayoutState

  @column()
  declare layoutMode: DiagramLayoutMode

  @column({
    prepare: (value: DiagramSettings | null) => JSON.stringify(value ?? {}),
    consume: (value: unknown) => parseJsonObject<DiagramSettings>(value, {}),
  })
  declare settings: DiagramSettings

  @column()
  declare sortOrder: number

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
