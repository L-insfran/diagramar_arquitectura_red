import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Project from './project.js'
import Port from './port.js'
import CableType from './cable_type.js'

export type MediumType = 'utp' | 'fiber' | 'wifi' | 'internet'
export type CableCategory = '5e' | '6' | '6a' | '7' | '7a' | '8'
export type FiberType = 'singlemode' | 'multimode'
export type FiberConnector = 'LC' | 'SC' | 'ST' | 'FC' | 'MPO' | 'MTRJ'
export type WifiStandard = '802.11n' | '802.11ac' | '802.11ax' | '802.11be'
export type WifiBand = '2.4GHz' | '5GHz' | '6GHz'
export type WifiSecurity = 'WPA2' | 'WPA3' | 'WPA2/WPA3' | 'Open'
export type ConnectionStatus = 'planned' | 'implemented' | 'verified'
export type PortFace = 'front' | 'rear'

export type ConnectionMetadata = {
  vlanId?: number
  vlanName?: string
  networkName?: string
  notes?: string
  status?: 'active' | 'down'
}

export default class Connection extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare projectId: string

  @column()
  declare sourcePortId: string

  @column()
  declare targetPortId: string

  @column()
  declare sourceFace: PortFace

  @column()
  declare targetFace: PortFace

  @column()
  declare connectionType: 'physical' | 'logical'

  @column()
  declare mediumType: MediumType

  @column()
  declare cableTypeId: string | null

  @column()
  declare cableCategory: CableCategory | null

  @column()
  declare fiberType: FiberType | null

  @column()
  declare fiberConnector: FiberConnector | null

  @column()
  declare wifiSsid: string | null

  @column()
  declare wifiStandard: WifiStandard | null

  @column()
  declare wifiBand: WifiBand | null

  @column()
  declare wifiSecurity: WifiSecurity | null

  @column()
  declare cableLength: string | null

  @column()
  declare connectionStatus: ConnectionStatus

  @column()
  declare bandwidth: string | null

  @column()
  declare description: string | null

  @column()
  declare metadata: ConnectionMetadata | null

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

  @belongsTo(() => Port, {
    foreignKey: 'sourcePortId',
  })
  declare sourcePort: BelongsTo<typeof Port>

  @belongsTo(() => Port, {
    foreignKey: 'targetPortId',
  })
  declare targetPort: BelongsTo<typeof Port>

  @belongsTo(() => CableType)
  declare cableType: BelongsTo<typeof CableType>
}
