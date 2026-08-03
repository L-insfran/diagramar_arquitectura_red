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

  /** Código del catálogo port_types (ej: ethernet, coaxial, wireless). */
  @column()
  declare portType: string

  @column()
  declare speed: string | null

  @column()
  declare status: 'up' | 'down' | 'disabled'

  @column()
  declare description: string | null

  /** Patch panel / bridge jack: front + rear faces each accept one physical link. */
  @column()
  declare isPassthrough: boolean

  /** Physical chassis side for non-passthrough jacks (ignored when isPassthrough). */
  @column()
  declare chassisFace: 'front' | 'rear'

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
