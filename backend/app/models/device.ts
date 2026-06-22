import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import Company from './company.js'
import DeviceType from './device_type.js'
import Port from './port.js'
import DeviceCredential from './device_credential.js'
import Employee from './employee.js'

export default class Device extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare companyId: string

  @column()
  declare deviceTypeId: string

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

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Company)
  declare company: BelongsTo<typeof Company>

  @belongsTo(() => DeviceType)
  declare deviceType: BelongsTo<typeof DeviceType>

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
