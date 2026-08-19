import { Exception } from '@adonisjs/core/exceptions'
import db from '@adonisjs/lucid/services/db'
import ContainerRepository from '#repositories/container_repository'
import RackAccessoryRepository from '#repositories/rack_accessory_repository'
import RackService from '#services/rack_service'
import type {
  ContainerFilters,
  CreateContainerInput,
  UpdateContainerInput,
} from '#dtos/container_dto'

export default class ContainerService {
  private containers = new ContainerRepository()
  private accessories = new RackAccessoryRepository()
  private rackService = new RackService()

  async getAllByProject(projectId: string, filters?: ContainerFilters) {
    return this.containers.findAllByProject(projectId, filters)
  }

  async getById(id: string) {
    return this.containers.findByIdOrFail(id)
  }

  async getSummary(id: string) {
    return this.containers.findSummaryOrFail(id)
  }

  async create(data: CreateContainerInput, actorId: string) {
    const area = await this.containers.findAreaWithSite(data.areaId)
    if (!area || area.site.projectId !== data.projectId) {
      throw new Exception('El área no pertenece al proyecto indicado', { status: 422 })
    }

    if (data.kind === 'rack') {
      const heightU = data.heightU ?? 42
      if (heightU < 1 || heightU > 60) {
        throw new Exception('heightU debe estar entre 1 y 60', { status: 422 })
      }
      data = { ...data, heightU }
    }

    if (data.kind === 'board') {
      if (!data.boardKind || !data.gridRows || !data.gridCols) {
        throw new Exception('boardKind, gridRows y gridCols son requeridos para tableros', {
          status: 422,
        })
      }
    }

    const container = await this.containers.create({
      ...data,
      createdBy: actorId,
      updatedBy: actorId,
    })
    return this.containers.findByIdOrFail(container.id)
  }

  async update(id: string, data: UpdateContainerInput, actorId: string) {
    const container = await this.containers.findSummaryOrFail(id)

    if (data.areaId) {
      const area = await this.containers.findAreaWithSite(data.areaId)
      if (!area || area.site.projectId !== container.projectId) {
        throw new Exception('El área no pertenece al proyecto del contenedor', { status: 422 })
      }
    }

    if (container.kind === 'rack' && data.heightU !== undefined && data.heightU !== null) {
      if (data.heightU < 1 || data.heightU > 60) {
        throw new Exception('heightU debe estar entre 1 y 60', { status: 422 })
      }
    }

    await this.containers.update(container, { ...data, updatedBy: actorId })
    return this.containers.findByIdOrFail(id)
  }

  async delete(id: string, actorId: string) {
    const container = await this.containers.findSummaryOrFail(id)
    const count = await this.containers.countActiveDevices(id)
    if (count > 0) {
      throw new Exception(
        `No se puede eliminar el contenedor: hay ${count} dispositivo(s) activo(s)`,
        { status: 409 }
      )
    }

    if (container.kind === 'rack') {
      const accessoryCount = await this.accessories.countActiveOnRack(id)
      if (accessoryCount > 0) {
        throw new Exception(
          `No se puede eliminar el contenedor: hay ${accessoryCount} bandeja(s)/accesorio(s)`,
          { status: 409 }
        )
      }
    }

    await this.containers.softDelete(container, actorId)
  }

  async moveDevices(
    sourceId: string,
    targetId: string,
    actorId: string,
    deviceIds?: string[],
  ) {
    const source = await this.containers.findSummaryOrFail(sourceId)
    const target = await this.containers.findSummaryOrFail(targetId)
    if (source.projectId !== target.projectId) {
      throw new Exception('Los contenedores deben pertenecer al mismo proyecto', { status: 422 })
    }

    const targetArea = await this.containers.findAreaWithSite(target.areaId)
    if (!targetArea) {
      throw new Exception('El área del contenedor destino no existe', { status: 422 })
    }

    await db.transaction(async (trx) => {
      const query = trx
        .from('devices')
        .where('container_id', sourceId)
        .whereNull('deleted_at')
      if (deviceIds?.length) {
        query.whereIn('id', deviceIds)
      }
      await query.update({
        container_id: targetId,
        area_id: target.areaId,
        site_id: targetArea.siteId,
        rack_unit_start: null,
        rack_face: null,
        board_row: null,
        board_col: null,
        board_row_span: null,
        board_col_span: null,
        supported_by_accessory_id: null,
        shelf_slot_start: null,
        shelf_width_slots: null,
        shelf_height_u: null,
        updated_by: actorId,
        updated_at: new Date(),
      })
    })
  }

  async getOccupancy(id: string) {
    const container = await this.containers.findSummaryOrFail(id)

    if (container.kind === 'rack') {
      return this.rackService.getOccupancy(id)
    }

    if (container.kind === 'board') {
      const devices = await this.containers.findDevicesInContainer(id)
      return {
        containerId: container.id,
        kind: container.kind,
        gridRows: container.gridRows,
        gridCols: container.gridCols,
        deviceCount: devices.length,
        devices: devices.map((d) => ({
          id: d.id,
          name: d.name,
          boardRow: d.boardRow,
          boardCol: d.boardCol,
          boardRowSpan: d.boardRowSpan,
          boardColSpan: d.boardColSpan,
        })),
      }
    }

    const devices = await this.containers.findDevicesInContainer(id)
    return {
      containerId: container.id,
      kind: container.kind,
      deviceCount: devices.length,
      devices: devices.map((d) => ({ id: d.id, name: d.name })),
    }
  }
}
