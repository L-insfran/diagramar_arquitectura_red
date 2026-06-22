import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Port from './port.js'
import Vlan from './vlan.js'

export default class PortVlan extends BaseModel {
  static table = 'port_vlans'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare portId: string

  @column()
  declare vlanId: string

  @column()
  declare isTagged: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Port)
  declare port: BelongsTo<typeof Port>

  @belongsTo(() => Vlan)
  declare vlan: BelongsTo<typeof Vlan>
}
