import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import RackAccessory from './rack_accessory.js'

export type AccessoryKind = 'shelf' | 'hang' | 'chassis'
export type ShelfMountType = 'front_only' | 'four_post'
export type AccessoryFace = 'front' | 'rear'

export default class RackAccessoryTemplate extends BaseModel {
  static table = 'rack_accessory_templates'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare name: string

  @column()
  declare kind: AccessoryKind

  @column()
  declare heightU: number

  @column()
  declare defaultMountType: ShelfMountType

  /** Device host slots per face (3–5). */
  @column()
  declare deviceSlotCount: number

  /** Required for hang templates; null for shelf. */
  @column()
  declare face: AccessoryFace | null

  /** Default horizontal start column on the 6-wide rack grid (0-based). */
  @column()
  declare horizontalSlotStart: number

  /** Default horizontal width in columns (2–6). */
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

  @hasMany(() => RackAccessory, { foreignKey: 'accessoryTemplateId' })
  declare accessories: HasMany<typeof RackAccessory>
}
