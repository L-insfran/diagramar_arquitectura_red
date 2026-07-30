import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Project from './project.js'
import SystemUser from './system_user.js'

export default class ProjectMembership extends BaseModel {
  static table = 'project_memberships'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare systemUserId: string

  @column()
  declare projectId: string

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

  @belongsTo(() => Project)
  declare project: BelongsTo<typeof Project>
}
