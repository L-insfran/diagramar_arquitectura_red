import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import Project from './project.js'
import Network from './network.js'
import Port from './port.js'

export default class Vlan extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare projectId: string

  /** 802.1Q VLAN tag (column `vlan_id` on `vlans`). */
  @column()
  declare vlanId: number

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Project)
  declare project: BelongsTo<typeof Project>

  @hasMany(() => Network)
  declare networks: HasMany<typeof Network>

  @manyToMany(() => Port, {
    pivotTable: 'port_vlans',
    pivotColumns: ['is_tagged'],
  })
  declare ports: ManyToMany<typeof Port>
}
