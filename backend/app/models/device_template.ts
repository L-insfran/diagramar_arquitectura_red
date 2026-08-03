import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import DeviceType from './device_type.js'
import DeviceTemplatePort from './device_template_port.js'
import Device from './device.js'
import SystemUser from './system_user.js'

export default class DeviceTemplate extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare deviceTypeId: string

  @column()
  declare name: string

  @column()
  declare manufacturer: string | null

  @column()
  declare model: string | null

  @column()
  declare rackUnits: number | null

  /** When true, rail/shelf instances occupy the same U on front and rear. */
  @column()
  declare isFullDepth: boolean

  @column()
  declare imageUrl: string | null

  @column()
  declare frontViewUrl: string | null

  @column()
  declare rearViewUrl: string | null

  @column()
  declare powerConsumptionW: number | null

  @column()
  declare weightKg: number | null

  @column({
    prepare: (value: Record<string, unknown> | null) => JSON.stringify(value ?? {}),
    consume: (value: string | Record<string, unknown> | null) => {
      if (value === null || value === undefined) return {}
      if (typeof value === 'string') {
        try {
          return JSON.parse(value) as Record<string, unknown>
        } catch {
          return {}
        }
      }
      return value
    },
  })
  declare customFields: Record<string, unknown>

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

  @belongsTo(() => DeviceType)
  declare deviceType: BelongsTo<typeof DeviceType>

  @hasMany(() => DeviceTemplatePort)
  declare ports: HasMany<typeof DeviceTemplatePort>

  @hasMany(() => Device)
  declare devices: HasMany<typeof Device>

  @belongsTo(() => SystemUser, { foreignKey: 'createdBy' })
  declare creator: BelongsTo<typeof SystemUser>
}
