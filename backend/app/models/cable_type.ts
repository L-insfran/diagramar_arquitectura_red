import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

/** Family used to derive connections.medium_type (power/console/other → utp fallback). */
export type CableMediumFamily =
  | 'utp'
  | 'fiber'
  | 'wifi'
  | 'internet'
  | 'power'
  | 'console'
  | 'other'

export default class CableType extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare code: string

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column()
  declare mediumFamily: CableMediumFamily

  @column()
  declare defaultCategory: string | null

  @column()
  declare defaultFiberType: string | null

  @column()
  declare color: string | null

  @column()
  declare sortOrder: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
