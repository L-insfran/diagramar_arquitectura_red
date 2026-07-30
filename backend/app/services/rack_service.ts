import { Exception } from '@adonisjs/core/exceptions'
import RackRepository from '#repositories/rack_repository'
import type {
  CreateRackInput,
  RackFace,
  RackFilters,
  RackOccupancy,
  RackOccupancySlot,
  UpdateRackInput,
} from '#dtos/rack_dto'

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart <= bEnd && bStart <= aEnd
}

export default class RackService {
  private racks = new RackRepository()

  async getAllByProject(projectId: string, filters?: RackFilters) {
    return this.racks.findAllByProject(projectId, filters)
  }

  async getById(id: string) {
    return this.racks.findByIdOrFail(id)
  }

  async getSummary(id: string) {
    return this.racks.findSummaryOrFail(id)
  }

  async create(data: CreateRackInput, actorId: string) {
    const area = await this.racks.findAreaWithSite(data.areaId)
    if (!area || area.site.projectId !== data.projectId) {
      throw new Exception('El área no pertenece al proyecto indicado', { status: 422 })
    }
    const heightU = data.heightU ?? 42
    if (heightU < 1 || heightU > 60) {
      throw new Exception('heightU debe estar entre 1 y 60', { status: 422 })
    }
    const rack = await this.racks.create({
      ...data,
      heightU,
      createdBy: actorId,
      updatedBy: actorId,
    })
    return this.racks.findByIdOrFail(rack.id)
  }

  async update(id: string, data: UpdateRackInput, actorId: string) {
    const rack = await this.racks.findSummaryOrFail(id)
    if (data.areaId) {
      const area = await this.racks.findAreaWithSite(data.areaId)
      if (!area || area.site.projectId !== rack.projectId) {
        throw new Exception('El área no pertenece al proyecto del rack', { status: 422 })
      }
    }
    if (data.heightU !== undefined) {
      if (data.heightU < 1 || data.heightU > 60) {
        throw new Exception('heightU debe estar entre 1 y 60', { status: 422 })
      }
      const mounted = await this.racks.findMountedDevices(id)
      for (const device of mounted) {
        const height = device.deviceTemplate?.rackUnits ?? 1
        const end = (device.rackUnitStart ?? 1) + height - 1
        if (end > data.heightU) {
          throw new Exception(
            `No se puede reducir a ${data.heightU}U: "${device.name}" ocupa hasta U${end}`,
            { status: 409 }
          )
        }
      }
    }
    await this.racks.update(rack, { ...data, updatedBy: actorId })
    return this.racks.findByIdOrFail(id)
  }

  async delete(id: string, actorId: string) {
    const rack = await this.racks.findSummaryOrFail(id)
    const count = await this.racks.countActiveDevices(id)
    if (count > 0) {
      throw new Exception(
        `No se puede eliminar el rack: hay ${count} dispositivo(s) montado(s)`,
        { status: 409 }
      )
    }
    await this.racks.softDelete(rack, actorId)
  }

  async getOccupancy(id: string): Promise<RackOccupancy> {
    const rack = await this.racks.findByIdOrFail(id)
    const mounted = await this.racks.findMountedDevices(id)
    const devices = mounted.map((d) => {
      const heightU = Math.max(1, d.deviceTemplate?.rackUnits ?? 1)
      const start = d.rackUnitStart ?? 1
      const face = (d.rackFace ?? 'front') as RackFace
      return {
        id: d.id,
        name: d.name,
        rackUnitStart: start,
        rackFace: face,
        heightU,
        rackUnitEnd: start + heightU - 1,
      }
    })

    const usedUnits = new Set<string>()
    for (const d of devices) {
      for (let u = d.rackUnitStart; u <= d.rackUnitEnd; u++) {
        usedUnits.add(`${d.rackFace}:${u}`)
      }
    }
    const usedU = usedUnits.size
    const capacity = rack.heightU * 2
    const freeU = Math.max(0, capacity - usedU)

    return {
      rackId: rack.id,
      heightU: rack.heightU,
      usedU,
      freeU,
      percentUsed: capacity === 0 ? 0 : Math.round((usedU / capacity) * 1000) / 10,
      devices,
      slotsFront: this.buildSlots(rack.heightU, devices, 'front'),
      slotsRear: this.buildSlots(rack.heightU, devices, 'rear'),
    }
  }

  private buildSlots(
    heightU: number,
    devices: RackOccupancy['devices'],
    face: RackFace
  ): RackOccupancySlot[] {
    const slots: RackOccupancySlot[] = []
    for (let unit = heightU; unit >= 1; unit--) {
      const owner = devices.find(
        (d) => d.rackFace === face && unit >= d.rackUnitStart && unit <= d.rackUnitEnd
      )
      slots.push({
        unit,
        deviceId: owner?.id ?? null,
        deviceName: owner?.name ?? null,
        face: owner ? face : null,
        isStart: owner ? unit === owner.rackUnitStart : false,
        heightU: owner?.heightU ?? 0,
      })
    }
    return slots
  }

  /**
   * Validate rack mount and sync site/area from rack.
   * Clears mount fields when rackId is null.
   */
  async resolveRackPlacement(params: {
    projectId: string
    rackId?: string | null
    rackUnitStart?: number | null
    rackFace?: RackFace | null
    heightU: number
    excludeDeviceId?: string
  }): Promise<{
    rackId: string
    rackUnitStart: number
    rackFace: RackFace
    siteId: string
    areaId: string
  }> {
    const rackId = params.rackId
    if (!rackId) {
      throw new Exception('rackId es requerido para montar', { status: 422 })
    }

    const rack = await this.racks.findActiveInProject(rackId, params.projectId)
    if (!rack) {
      throw new Exception('El rack no pertenece al proyecto o no existe', { status: 422 })
    }

    const start = params.rackUnitStart
    if (start == null || start < 1) {
      throw new Exception('rackUnitStart es obligatorio al montar en rack (≥ 1)', {
        status: 422,
      })
    }

    const heightU = Math.max(1, params.heightU)
    const end = start + heightU - 1
    if (end > rack.heightU) {
      throw new Exception(
        `El equipo (${heightU}U desde U${start}) no cabe en el rack de ${rack.heightU}U`,
        { status: 422 }
      )
    }

    const face: RackFace = params.rackFace ?? 'front'
    const mounted = await this.racks.findMountedDevices(rackId)
    for (const other of mounted) {
      if (params.excludeDeviceId && other.id === params.excludeDeviceId) continue
      const otherFace = (other.rackFace ?? 'front') as RackFace
      if (otherFace !== face) continue
      const otherHeight = Math.max(1, other.deviceTemplate?.rackUnits ?? 1)
      const otherStart = other.rackUnitStart ?? 1
      const otherEnd = otherStart + otherHeight - 1
      if (rangesOverlap(start, end, otherStart, otherEnd)) {
        throw new Exception(
          `Solape con "${other.name}" (U${otherStart}–U${otherEnd}, ${otherFace})`,
          { status: 409 }
        )
      }
    }

    return {
      rackId,
      rackUnitStart: start,
      rackFace: face,
      siteId: rack.area.siteId,
      areaId: rack.areaId,
    }
  }
}
