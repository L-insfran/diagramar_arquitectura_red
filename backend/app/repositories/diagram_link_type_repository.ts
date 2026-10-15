import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import DiagramLinkType from '#models/diagram_link_type'
import DiagramLink from '#models/diagram_link'
import type {
  CreateDiagramLinkTypeInput,
  UpdateDiagramLinkTypeInput,
} from '#dtos/diagram_link_type_dto'
import { normalizeDiagramLinkLineStyle } from '#dtos/diagram_link_type_dto'

export default class DiagramLinkTypeRepository {
  async findAllByProject(projectId: string) {
    return DiagramLinkType.query()
      .where('project_id', projectId)
      .whereNull('deleted_at')
      .orderBy('sort_order', 'asc')
      .orderBy('name', 'asc')
  }

  async findByIdOrFail(id: string) {
    return DiagramLinkType.query().where('id', id).whereNull('deleted_at').firstOrFail()
  }

  async findActiveInProject(id: string, projectId: string) {
    return DiagramLinkType.query()
      .where('id', id)
      .where('project_id', projectId)
      .whereNull('deleted_at')
      .first()
  }

  async findActiveByName(projectId: string, name: string, excludeId?: string) {
    const query = DiagramLinkType.query()
      .where('project_id', projectId)
      .whereNull('deleted_at')
      .whereRaw('lower(name) = ?', [name.trim().toLowerCase()])
    if (excludeId) query.whereNot('id', excludeId)
    return query.first()
  }

  async findDefaultByProject(projectId: string) {
    return DiagramLinkType.query()
      .where('project_id', projectId)
      .where('is_default', true)
      .whereNull('deleted_at')
      .first()
  }

  async countActiveLinks(typeId: string) {
    const row = await DiagramLink.query()
      .where('link_type_id', typeId)
      .whereNull('deleted_at')
      .count('* as total')
      .first()
    return Number(row?.$extras.total ?? 0)
  }

  async clearDefaults(
    projectId: string,
    trx: TransactionClientContract,
    exceptId?: string
  ) {
    const query = trx
      .from('diagram_link_types')
      .where('project_id', projectId)
      .where('is_default', true)
      .whereNull('deleted_at')
    if (exceptId) query.whereNot('id', exceptId)
    await query.update({
      is_default: false,
      updated_at: DateTime.now().toSQL(),
    })
  }

  async create(
    data: CreateDiagramLinkTypeInput & { createdBy: string; updatedBy: string },
    trx?: TransactionClientContract
  ) {
    return DiagramLinkType.create(
      {
        projectId: data.projectId,
        name: data.name.trim(),
        color: data.color.trim().toLowerCase(),
        description: data.description?.trim() || null,
        sortOrder: data.sortOrder ?? 0,
        isDefault: data.isDefault === true,
        lineStyle: normalizeDiagramLinkLineStyle(data.lineStyle),
        createdBy: data.createdBy,
        updatedBy: data.updatedBy,
      },
      trx ? { client: trx } : undefined
    )
  }

  async update(
    type: DiagramLinkType,
    data: UpdateDiagramLinkTypeInput & { updatedBy: string },
    trx?: TransactionClientContract
  ) {
    if (trx) type.useTransaction(trx)
    if (data.name !== undefined) type.name = data.name.trim()
    if (data.color !== undefined) type.color = data.color.trim().toLowerCase()
    if (data.description !== undefined) type.description = data.description?.trim() || null
    if (data.sortOrder !== undefined) type.sortOrder = data.sortOrder
    if (data.isDefault !== undefined) type.isDefault = data.isDefault
    if (data.lineStyle !== undefined) type.lineStyle = normalizeDiagramLinkLineStyle(data.lineStyle)
    type.updatedBy = data.updatedBy
    await type.save()
    return type
  }

  async softDelete(type: DiagramLinkType, deletedBy: string) {
    const now = DateTime.now()
    type.deletedAt = now
    type.deletedBy = deletedBy
    type.updatedBy = deletedBy
    type.isDefault = false
    await type.save()
  }
}
