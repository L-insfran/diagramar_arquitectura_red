import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import Project from './project.js'
import DeviceType from './device_type.js'
import DeviceTemplate from './device_template.js'
import Site from './site.js'
import Area from './area.js'
import Rack from './rack.js'
import RackAccessory from './rack_accessory.js'
import Port from './port.js'
import DeviceCredential from './device_credential.js'
import Employee from './employee.js'

export default class Device extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare projectId: string

  @column()
  declare deviceTypeId: string

  @column()
  declare deviceTemplateId: string

  @column()
  declare siteId: string | null

  @column()
  declare areaId: string | null

  @column()
  declare rackId: string | null

  @column()
  declare rackUnitStart: number | null

  @column()
  declare rackFace: 'front' | 'rear' | null

  /** Device resting on a rack shelf (not rail-mounted). */
  @column()
  declare supportedByAccessoryId: string | null

  /** Horizontal slot start on shelf: 0 | 1 | 2 (thirds of 19"). */
  @column()
  declare shelfSlotStart: number | null

  /** Horizontal width in thirds: 1 = one third, 3 = full width. */
  @column()
  declare shelfWidthSlots: number | null

  /**
   * Vertical height (U) when resting on a shelf.
   * Anchored at shelf.unitStart; grows upward. Null → fall back to template.rackUnits.
   */
  @column()
  declare shelfHeightU: number | null

  @column()
  declare name: string

  @column()
  declare hostname: string | null

  @column()
  declare ipAddress: string | null

  @column()
  declare macAddress: string | null

  @column()
  declare model: string | null

  @column()
  declare manufacturer: string | null

  @column()
  declare serialNumber: string | null

  @column()
  declare firmwareVersion: string | null

  @column()
  declare location: string | null

  @column()
  declare status: 'online' | 'offline' | 'maintenance' | 'unknown'

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

  @belongsTo(() => Project)
  declare project: BelongsTo<typeof Project>

  @belongsTo(() => DeviceType)
  declare deviceType: BelongsTo<typeof DeviceType>

  @belongsTo(() => DeviceTemplate)
  declare deviceTemplate: BelongsTo<typeof DeviceTemplate>

  @belongsTo(() => Site)
  declare site: BelongsTo<typeof Site>

  @belongsTo(() => Area)
  declare area: BelongsTo<typeof Area>

  @belongsTo(() => Rack)
  declare rack: BelongsTo<typeof Rack>

  @belongsTo(() => RackAccessory, { foreignKey: 'supportedByAccessoryId' })
  declare supportedByAccessory: BelongsTo<typeof RackAccessory>

  @hasMany(() => Port)
  declare ports: HasMany<typeof Port>

  @hasMany(() => DeviceCredential)
  declare credentials: HasMany<typeof DeviceCredential>

  @manyToMany(() => Employee, {
    pivotTable: 'employee_devices',
    pivotColumns: ['role', 'assigned_at'],
  })
  declare employees: ManyToMany<typeof Employee>
}
