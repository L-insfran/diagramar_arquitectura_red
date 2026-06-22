import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Device from './device.js'

export default class DeviceCredential extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare deviceId: string

  @column()
  declare credentialType: 'ssh' | 'telnet' | 'snmp' | 'web' | 'api'

  @column()
  declare username: string | null

  @column({ serializeAs: null })
  declare password: string

  @column()
  declare port: number | null

  @column()
  declare communityString: string | null

  @column()
  declare notes: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Device)
  declare device: BelongsTo<typeof Device>
}
