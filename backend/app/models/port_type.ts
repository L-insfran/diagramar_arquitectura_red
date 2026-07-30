import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export type PortDirection = 'in' | 'out' | 'bidirectional'

export default class PortType extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  /** Slug estable usado en ports.port_type (ej: ethernet, coaxial). */
  @column()
  declare code: string

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column()
  declare defaultSpeed: string | null

  @column()
  declare color: string | null

  @column()
  declare icon: string | null

  @column()
  declare direction: PortDirection

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
