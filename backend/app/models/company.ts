import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Department from './department.js'
import SystemUser from './system_user.js'
import Employee from './employee.js'
import Device from './device.js'
import Vlan from './vlan.js'
import Network from './network.js'

export default class Company extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare name: string

  @column()
  declare domain: string | null

  @column()
  declare address: string | null

  @column()
  declare phone: string | null

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => Department)
  declare departments: HasMany<typeof Department>

  @hasMany(() => SystemUser)
  declare systemUsers: HasMany<typeof SystemUser>

  @hasMany(() => Employee)
  declare employees: HasMany<typeof Employee>

  @hasMany(() => Device)
  declare devices: HasMany<typeof Device>

  @hasMany(() => Vlan)
  declare vlans: HasMany<typeof Vlan>

  @hasMany(() => Network)
  declare networks: HasMany<typeof Network>
}
