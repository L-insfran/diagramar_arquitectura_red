import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Employee from './employee.js'
import Project from './project.js'

export type EmployeeCredentialKind = 'file_server' | 'vpn' | 'email' | 'rdp' | 'other'

export default class EmployeeCredential extends BaseModel {
  static table = 'employee_credentials'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare employeeId: string

  @column()
  declare projectId: string

  @column()
  declare kind: EmployeeCredentialKind

  @column()
  declare label: string | null

  @column()
  declare username: string

  /** Stored as AES-256-GCM ciphertext. Never serialized to API responses. */
  @column({ serializeAs: null })
  declare passwordCiphertext: string

  @column()
  declare notes: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Employee)
  declare employee: BelongsTo<typeof Employee>

  @belongsTo(() => Project)
  declare project: BelongsTo<typeof Project>
}
