import { DateTime } from 'luxon'
import { compose } from '@adonisjs/core/helpers'
import hash from '@adonisjs/core/services/hash'
import { BaseModel, column, belongsTo, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import Project from './project.js'
import ProjectMembership from './project_membership.js'

// withAuthFinder already registers a @beforeSave hook that hashes the password
// automatically whenever $dirty.password changes — no manual hook needed.
export default class SystemUser extends compose(
  BaseModel,
  withAuthFinder(hash, {
    uids: ['email'],
    passwordColumnName: 'password',
  })
) {
  static accessTokens = DbAccessTokensProvider.forModel(SystemUser, {
    table: 'access_tokens',
  })

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare projectId: string

  @column()
  declare email: string

  @column({ serializeAs: null })
  declare password: string

  @column()
  declare firstName: string

  @column()
  declare lastName: string

  @column()
  declare role: 'admin' | 'operator' | 'viewer'

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Project)
  declare project: BelongsTo<typeof Project>

  @hasMany(() => ProjectMembership)
  declare memberships: HasMany<typeof ProjectMembership>

  @manyToMany(() => Project, {
    pivotTable: 'project_memberships',
    pivotForeignKey: 'system_user_id',
    pivotRelatedForeignKey: 'project_id',
    pivotColumns: ['role', 'is_default'],
  })
  declare projects: ManyToMany<typeof Project>
}
