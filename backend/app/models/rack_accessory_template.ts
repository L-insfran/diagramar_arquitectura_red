import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import RackAccessory from './rack_accessory.js'

export type AccessoryKind = 'shelf'
export type ShelfMountType = 'front_only' | 'four_post'

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
