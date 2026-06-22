import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, ManyToMany } from '@adonisjs/lucid/types/relations'
import Device from './device.js'
import Vlan from './vlan.js'

export default class Port extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare deviceId: string

  @column()
  declare name: string

  @column()
  declare portNumber: number

  @column()
  declare portType: 'ethernet' | 'fiber' | 'serial' | 'wireless' | 'wan' | 'sfp'

  @column()
  declare speed: string | null

  @column()
  declare status: 'up' | 'down' | 'disabled'

  @column()
  declare description: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Device)
  declare device: BelongsTo<typeof Device>

  @manyToMany(() => Vlan, {
    pivotTable: 'port_vlans',
    pivotColumns: ['is_tagged'],
  })
  declare vlans: ManyToMany<typeof Vlan>
}
