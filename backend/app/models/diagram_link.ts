import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Project from './project.js'
import Device from './device.js'
import Port from './port.js'

export default class DiagramLink extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare projectId: string

  @column()
  declare code: number

  @column()
  declare sourceDeviceId: string

  @column()
  declare targetDeviceId: string

  @column()
  declare sourcePortId: string | null

  @column()
  declare targetPortId: string | null

  @column()
  declare sourcePortLabel: string

  @column()
  declare targetPortLabel: string

  @column()
  declare description: string | null

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

  @belongsTo(() => Device, { foreignKey: 'sourceDeviceId' })
  declare sourceDevice: BelongsTo<typeof Device>

  @belongsTo(() => Device, { foreignKey: 'targetDeviceId' })
  declare targetDevice: BelongsTo<typeof Device>

  @belongsTo(() => Port, { foreignKey: 'sourcePortId' })
  declare sourcePort: BelongsTo<typeof Port>

  @belongsTo(() => Port, { foreignKey: 'targetPortId' })
  declare targetPort: BelongsTo<typeof Port>
}
