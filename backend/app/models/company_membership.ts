import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Company from './company.js'
import SystemUser from './system_user.js'

export default class CompanyMembership extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare systemUserId: string

  @column()
  declare companyId: string

  @column()
  declare role: 'admin' | 'operator' | 'viewer'

  @column()
  declare isDefault: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => SystemUser)
  declare systemUser: BelongsTo<typeof SystemUser>

  @belongsTo(() => Company)
  declare company: BelongsTo<typeof Company>
}
