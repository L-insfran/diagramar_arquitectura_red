import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Company from './company.js'
import Vlan from './vlan.js'

export default class Network extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare companyId: string

  @column()
  declare vlanId: string | null

  @column()
  declare name: string

  @column()
  declare subnet: string

  @column()
  declare gateway: string | null

  @column()
  declare dnsPrimary: string | null

  @column()
  declare dnsSecondary: string | null

  @column()
  declare dhcpEnabled: boolean

  @column()
  declare description: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Company)
  declare company: BelongsTo<typeof Company>

  @belongsTo(() => Vlan)
  declare vlan: BelongsTo<typeof Vlan>
}
