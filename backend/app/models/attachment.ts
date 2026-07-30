import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Project from './project.js'
import type { AttachableType, AttachmentKind } from '#dtos/documentation_dto'

export default class Attachment extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare projectId: string

  @column()
  declare attachableType: AttachableType

  @column()
  declare attachableId: string

  @column()
  declare kind: AttachmentKind

  @column()
  declare title: string

  @column()
  declare description: string | null

  @column()
  declare url: string | null

  @column()
  declare storagePath: string | null

  @column()
  declare mimeType: string | null

  @column()
  declare sizeBytes: number | null

  @column()
  declare originalFilename: string | null

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

  get hasFile(): boolean {
    return Boolean(this.storagePath)
  }
}
