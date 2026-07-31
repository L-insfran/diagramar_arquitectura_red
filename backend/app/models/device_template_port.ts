import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import DeviceTemplate from './device_template.js'

export default class DeviceTemplatePort extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare deviceTemplateId: string

  @column()
  declare name: string

  @column()
  declare portNumber: number

  @column()
  declare portType: string

  @column()
  declare speed: string | null

  @column()
  declare description: string | null

  @column()
  declare isPassthrough: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => DeviceTemplate)
  declare deviceTemplate: BelongsTo<typeof DeviceTemplate>
}
