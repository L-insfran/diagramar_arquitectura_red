import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class SystemSetting extends BaseModel {
  static table = 'system_settings'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare reportTagline: string | null

  @column()
  declare logoStoragePath: string | null

  @column()
  declare logoMimeType: string | null

  @column()
  declare logoOriginalFilename: string | null

  @column()
  declare logoSizeBytes: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
