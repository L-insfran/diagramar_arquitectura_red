import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Employee from './employee.js'
import Device from './device.js'

export default class EmployeeDevice extends BaseModel {
  static table = 'employee_devices'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare employeeId: string

  @column()
  declare deviceId: string

  @column()
  declare role: string | null

  @column.dateTime()
  declare assignedAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Employee)
  declare employee: BelongsTo<typeof Employee>

  @belongsTo(() => Device)
  declare device: BelongsTo<typeof Device>
}
