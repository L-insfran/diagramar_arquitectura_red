import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import Project from './project.js'
import Department from './department.js'
import Device from './device.js'
import EmployeeCredential from './employee_credential.js'

export default class Employee extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare projectId: string

  @column()
  declare departmentId: string | null

  @column()
  declare firstName: string

  @column()
  declare lastName: string

  @column()
  declare email: string | null

  @column()
  declare phone: string | null

  @column()
  declare position: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Project)
  declare project: BelongsTo<typeof Project>

  @belongsTo(() => Department)
  declare department: BelongsTo<typeof Department>

  @hasMany(() => EmployeeCredential)
  declare networkCredentials: HasMany<typeof EmployeeCredential>

  @manyToMany(() => Device, {
    pivotTable: 'employee_devices',
    pivotColumns: ['role', 'assigned_at'],
  })
  declare devices: ManyToMany<typeof Device>
}
