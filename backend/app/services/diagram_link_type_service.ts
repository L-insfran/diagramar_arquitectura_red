import { Exception } from '@adonisjs/core/exceptions'
import db from '@adonisjs/lucid/services/db'
import DiagramLinkTypeRepository from '#repositories/diagram_link_type_repository'
import type {
  CreateDiagramLinkTypeInput,
  DiagramLinkTypeApi,
  UpdateDiagramLinkTypeInput,
} from '#dtos/diagram_link_type_dto'
import { normalizeDiagramLinkLineStyle } from '#dtos/diagram_link_type_dto'
import type DiagramLinkType from '#models/diagram_link_type'

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string }).code === '23505'
}

export default class DiagramLinkTypeService {
  private types = new DiagramLinkTypeRepository()

  toApi(type: DiagramLinkType): DiagramLinkTypeApi {
    return {
      id: type.id,
      projectId: type.projectId,
      name: type.name,
      color: type.color,
      description: type.description,
      sortOrder: type.sortOrder,
      isDefault: type.isDefault,
      lineStyle: normalizeDiagramLinkLineStyle(type.lineStyle),
      createdAt: type.createdAt?.toISO?.() ?? null,
      updatedAt: type.updatedAt?.toISO?.() ?? null,
    }
  }

  async listByProject(projectId: string) {
    const rows = await this.types.findAllByProject(projectId)
    return rows.map((row) => this.toApi(row))
  }

  async getById(id: string) {
    return this.types.findByIdOrFail(id)
  }

  async findDefaultId(projectId: string) {
    const row = await this.types.findDefaultByProject(projectId)
    return row?.id ?? null
  }

  async assertActiveInProject(id: string, projectId: string) {
    const type = await this.types.findActiveInProject(id, projectId)
    if (!type) {
      throw new Exception('Tipo de enlace no encontrado en el proyecto', { status: 422 })
    }
    return type
  }

  private async assertNameAvailable(projectId: string, name: string, excludeId?: string) {
    const existing = await this.types.findActiveByName(projectId, name, excludeId)
    if (existing) {
      throw new Exception(`Ya existe un tipo de enlace llamado "${name.trim()}"`, { status: 409 })
    }
  }

  async create(data: CreateDiagramLinkTypeInput, actorId: string) {
    await this.assertNameAvailable(data.projectId, data.name)
    try {
      const created = await db.transaction(async (trx) => {
        if (data.isDefault) {
          await this.types.clearDefaults(data.projectId, trx)
        }
        return this.types.create(
          { ...data, createdBy: actorId, updatedBy: actorId },
          trx
        )
      })
      return this.types.findByIdOrFail(created.id)
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new Exception(`Ya existe un tipo de enlace llamado "${data.name.trim()}"`, {
          status: 409,
        })
      }
      throw error
    }
  }

  async update(id: string, data: UpdateDiagramLinkTypeInput, actorId: string) {
    const existing = await this.types.findByIdOrFail(id)
    if (data.name !== undefined) {
      await this.assertNameAvailable(existing.projectId, data.name, id)
    }
    try {
      await db.transaction(async (trx) => {
        if (data.isDefault === true) {
          await this.types.clearDefaults(existing.projectId, trx, id)
        }
        await this.types.update(existing, { ...data, updatedBy: actorId }, trx)
      })
      return this.types.findByIdOrFail(id)
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new Exception('Ya existe un tipo de enlace con ese nombre', { status: 409 })
      }
      throw error
    }
  }

  async delete(id: string, actorId: string) {
    const type = await this.types.findByIdOrFail(id)
    const inUse = await this.types.countActiveLinks(id)
    if (inUse > 0) {
      throw new Exception(
        `No se puede eliminar "${type.name}": hay ${inUse} enlace(s) activo(s) que lo usan`,
        { status: 409 }
      )
    }
    await this.types.softDelete(type, actorId)
  }
}
