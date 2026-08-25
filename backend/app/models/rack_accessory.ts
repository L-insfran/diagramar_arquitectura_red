import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Project from './project.js'
import Container from './container.js'
import RackAccessoryTemplate from './rack_accessory_template.js'
import Device from './device.js'
import type {
  AccessoryFace,
  AccessoryKind,
  ShelfMountType,
} from './rack_accessory_template.js'

export default class RackAccessory extends BaseModel {
  static table = 'rack_accessories'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare projectId: string

  @column()
  declare containerId: string

  @column()
  declare accessoryTemplateId: string | null

  @column()
  declare name: string

  @column()
  declare kind: AccessoryKind

  @column()
  declare unitStart: number

  @column()
  declare heightU: number

  @column()
  declare mountType: ShelfMountType

  /** Device host slots per face (3–5). */
  @column()
  declare deviceSlotCount: number

  /** Required for hang; null for shelf. */
  @column()
  declare face: AccessoryFace | null

  /** Horizontal start column on the 6-wide rack grid (0-based). */
  @column()
  declare horizontalSlotStart: number

  /** Horizontal width in columns (2–6). */
  @column()
  declare horizontalWidthSlots: number

  @column()
  declare manufacturer: string | null

  @column()
  declare model: string | null

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

  @belongsTo(() => Container)
  declare container: BelongsTo<typeof Container>

  @belongsTo(() => RackAccessoryTemplate, { foreignKey: 'accessoryTemplateId' })
  declare accessoryTemplate: BelongsTo<typeof RackAccessoryTemplate>

  @hasMany(() => Device, { foreignKey: 'supportedByAccessoryId' })
  declare supportedDevices: HasMany<typeof Device>
}
