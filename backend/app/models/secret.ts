import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Project from './project.js'
import type { AttachableType, SecretKind } from '#dtos/documentation_dto'

export default class Secret extends BaseModel {
  static table = 'secrets'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare projectId: string

  @column()
  declare attachableType: AttachableType

  @column()
  declare attachableId: string

  @column()
  declare kind: SecretKind

  @column()
  declare label: string

  @column()
  declare username: string | null

  @column({ serializeAs: null })
  declare valueCiphertext: string

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
}
