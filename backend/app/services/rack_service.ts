import { Exception } from '@adonisjs/core/exceptions'
import RackRepository from '#repositories/rack_repository'
import RackAccessoryRepository from '#repositories/rack_accessory_repository'
import { facesForMountType } from '#dtos/rack_accessory_dto'
import type {
  CreateRackInput,
  DeviceRackFace,
  OccupantKind,
  RackFace,
  RackFilters,
  RackOccupancy,
  RackOccupancyAccessory,
  RackOccupancySlot,
  ShelfMountType,
  UpdateRackInput,
} from '#dtos/rack_dto'
import {
  aggregateUsedUnitsByFace,
  facesForDeviceRackFace,
  footprintsOverlap,
  railDeviceFootprints,
  resolveShelfDeviceFace,
  shelfDeviceFootprints,
  shelfDeviceHeightU,
  shelfFootprints,
  type RackFootprint,
} from '#services/rack_layout'

type RailOccupant = {
  kind: OccupantKind
  id: string
  name: string
  rackUnitStart: number
  rackUnitEnd: number
  heightU: number
  rackFace: RackFace
  mountType: ShelfMountType | null
  slotStart: number
  slotEnd: number
}

function normalizeDeviceRackFace(
  face: DeviceRackFace | string | null | undefined,
  isFullDepth?: boolean
): DeviceRackFace {
  if (isFullDepth || face === 'both') return 'both'
  if (face === 'rear') return 'rear'
  return 'front'
}

export default class RackService {
  private racks = new RackRepository()
  private accessories = new RackAccessoryRepository()

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
        if (device.supportedByAccessoryId) continue
        const height = device.deviceTemplate?.rackUnits ?? 1
        const end = (device.rackUnitStart ?? 1) + height - 1
        if (end > data.heightU) {
          throw new Exception(
            `No se puede reducir a ${data.heightU}U: "${device.name}" ocupa hasta U${end}`,
            { status: 409 }
          )
        }
      }
      const shelves = await this.accessories.findByRack(id)
      for (const shelf of shelves) {
        const end = shelf.unitStart + shelf.heightU - 1
        if (end > data.heightU) {
          throw new Exception(
            `No se puede reducir a ${data.heightU}U: bandeja "${shelf.name}" ocupa hasta U${end}`,
            { status: 409 }
          )
        }
      }
      const shelfDevices = await this.accessories.findShelfDevicesByRack(id)
      for (const device of shelfDevices) {
        const shelf = device.supportedByAccessory
        if (!shelf) continue
        const height = shelfDeviceHeightU(device.shelfHeightU, device.deviceTemplate?.rackUnits)
        const end = shelf.unitStart + height - 1
        if (end > data.heightU) {
          throw new Exception(
            `No se puede reducir a ${data.heightU}U: equipo apoyado "${device.name}" ocupa hasta U${end}`,
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
    const accessoryCount = await this.accessories.countActiveOnRack(id)
    if (accessoryCount > 0) {
      throw new Exception(
        `No se puede eliminar el rack: hay ${accessoryCount} bandeja(s)/accesorio(s)`,
        { status: 409 }
      )
    }
    await this.racks.softDelete(rack, actorId)
  }

  async getOccupancy(id: string): Promise<RackOccupancy> {
    const rack = await this.racks.findByIdOrFail(id)
    const mounted = await this.racks.findMountedDevices(id)
    const shelves = await this.accessories.findByRack(id)

    const devices = mounted
      .filter((d) => !d.supportedByAccessoryId && d.rackUnitStart != null)
      .map((d) => {
        const heightU = Math.max(1, d.deviceTemplate?.rackUnits ?? 1)
        const start = d.rackUnitStart ?? 1
        const face = normalizeDeviceRackFace(
          d.rackFace,
          !!d.deviceTemplate?.isFullDepth
        )
        return {
          id: d.id,
          name: d.name,
          rackUnitStart: start,
          rackFace: face,
          heightU,
          rackUnitEnd: start + heightU - 1,
        }
      })

    const accessories: RackOccupancyAccessory[] = []
    for (const shelf of shelves) {
      const onShelf = await this.accessories.findDevicesOnAccessory(shelf.id)
      const faces = facesForMountType(shelf.mountType)
      accessories.push({
        id: shelf.id,
        name: shelf.name,
        kind: 'shelf',
        unitStart: shelf.unitStart,
        heightU: shelf.heightU,
        unitEnd: shelf.unitStart + shelf.heightU - 1,
        mountType: shelf.mountType,
        faces,
        devices: onShelf.map((d) => {
          const heightU = shelfDeviceHeightU(d.shelfHeightU, d.deviceTemplate?.rackUnits)
          return {
            id: d.id,
            name: d.name,
            shelfSlotStart: d.shelfSlotStart ?? 0,
            shelfWidthSlots: d.shelfWidthSlots ?? 1,
            heightU,
            unitEnd: shelf.unitStart + heightU - 1,
            rackFace: resolveShelfDeviceFace(
              shelf.mountType,
              d.rackFace as DeviceRackFace | null,
              !!d.deviceTemplate?.isFullDepth
            ),
          }
        }),
      })
    }

    const railOccupants: RailOccupant[] = [
      ...devices.flatMap((d) =>
        facesForDeviceRackFace(d.rackFace).map((face) => ({
          kind: 'device' as const,
          id: d.id,
          name: d.name,
          rackUnitStart: d.rackUnitStart,
          rackUnitEnd: d.rackUnitEnd,
          heightU: d.heightU,
          rackFace: face,
          mountType: null,
          slotStart: 0,
          slotEnd: 2,
        }))
      ),
      ...accessories.flatMap((a) =>
        a.faces.map((face) => ({
          kind: 'shelf' as const,
          id: a.id,
          name: a.name,
          rackUnitStart: a.unitStart,
          rackUnitEnd: a.unitEnd,
          heightU: a.heightU,
          rackFace: face,
          mountType: a.mountType,
          slotStart: 0,
          slotEnd: 2,
        }))
      ),
      ...accessories.flatMap((a) =>
        a.devices.flatMap((d) => {
          const fps = shelfDeviceFootprints({
            deviceId: d.id,
            deviceName: d.name,
            shelfUnitStart: a.unitStart,
            face: d.rackFace,
            heightU: d.heightU,
            shelfSlotStart: d.shelfSlotStart,
            shelfWidthSlots: d.shelfWidthSlots,
          })
          return fps.map((fp) => ({
            kind: 'shelf_device' as const,
            id: fp.id,
            name: fp.name,
            rackUnitStart: fp.unitStart,
            rackUnitEnd: fp.unitEnd,
            heightU: d.heightU,
            rackFace: fp.face,
            mountType: a.mountType,
            slotStart: fp.slotStart,
            slotEnd: fp.slotEnd,
          }))
        })
      ),
    ]

    const footprints: RackFootprint[] = [
      ...devices.flatMap((d) =>
        railDeviceFootprints({
          deviceId: d.id,
          deviceName: d.name,
          face: d.rackFace,
          unitStart: d.rackUnitStart,
          heightU: d.heightU,
        })
      ),
      ...accessories.flatMap((a) =>
        shelfFootprints({
          accessoryId: a.id,
          accessoryName: a.name,
          unitStart: a.unitStart,
          heightU: a.heightU,
          mountType: a.mountType,
        })
      ),
      ...accessories.flatMap((a) =>
        a.devices.flatMap((d) =>
          shelfDeviceFootprints({
            deviceId: d.id,
            deviceName: d.name,
            shelfUnitStart: a.unitStart,
            face: d.rackFace,
            heightU: d.heightU,
            shelfSlotStart: d.shelfSlotStart,
            shelfWidthSlots: d.shelfWidthSlots,
          })
        )
      ),
    ]

    const agg = aggregateUsedUnitsByFace(footprints)
    const usedU = agg.usedU
    const capacity = rack.heightU * 2
    const freeU = Math.max(0, capacity - usedU)

    return {
      rackId: rack.id,
      heightU: rack.heightU,
      usedU,
      freeU,
      percentUsed: capacity === 0 ? 0 : Math.round((usedU / capacity) * 1000) / 10,
      devices,
      accessories,
      slotsFront: this.buildSlots(rack.heightU, railOccupants, 'front'),
      slotsRear: this.buildSlots(rack.heightU, railOccupants, 'rear'),
    }
  }

  private buildSlots(
    heightU: number,
    occupants: RailOccupant[],
    face: RackFace
  ): RackOccupancySlot[] {
    const preferredAt = (unit: number): RailOccupant | null => {
      const faceOccupants = occupants.filter(
        (d) => d.rackFace === face && unit >= d.rackUnitStart && unit <= d.rackUnitEnd
      )
      return (
        faceOccupants.find((d) => d.kind === 'device' || d.kind === 'shelf') ??
        faceOccupants[0] ??
        null
      )
    }

    const visibleStartFor = (owner: RailOccupant): number => {
      if (owner.kind !== 'shelf_device') return owner.rackUnitStart
      for (let u = owner.rackUnitStart; u <= owner.rackUnitEnd; u++) {
        const preferred = preferredAt(u)
        if (preferred?.kind === 'shelf_device' && preferred.id === owner.id) {
          return u
        }
      }
      return owner.rackUnitStart
    }

    const slots: RackOccupancySlot[] = []
    for (let unit = heightU; unit >= 1; unit--) {
      const owner = preferredAt(unit)
      const visibleStart = owner ? visibleStartFor(owner) : 0
      const visibleHeight = owner ? owner.rackUnitEnd - visibleStart + 1 : 0

      slots.push({
        unit,
        deviceId:
          owner?.kind === 'device' || owner?.kind === 'shelf_device' ? owner.id : null,
        deviceName:
          owner?.kind === 'device' || owner?.kind === 'shelf_device' ? owner.name : null,
        accessoryId: owner?.kind === 'shelf' ? owner.id : null,
        accessoryName: owner?.kind === 'shelf' ? owner.name : null,
        occupantKind: owner?.kind ?? null,
        mountType: owner?.mountType ?? null,
        face: owner ? face : null,
        isStart: owner ? unit === visibleStart : false,
        heightU: owner?.kind === 'shelf_device' ? visibleHeight : (owner?.heightU ?? 0),
        slotStart: owner?.kind === 'shelf_device' ? owner.slotStart : null,
        slotEnd: owner?.kind === 'shelf_device' ? owner.slotEnd : null,
      })
    }
    return slots
  }

  /**
   * Validate rack mount and sync site/area from rack.
   * Clears mount fields when rackId is null.
   * Also rejects overlap with shelves and shelf-resting devices on the affected face(s).
   * Full-depth templates force rackFace = both and check both faces.
   */
  async resolveRackPlacement(params: {
    projectId: string
    rackId?: string | null
    rackUnitStart?: number | null
    rackFace?: DeviceRackFace | null
    heightU: number
    isFullDepth?: boolean
    excludeDeviceId?: string
  }): Promise<{
    rackId: string
    rackUnitStart: number
    rackFace: DeviceRackFace
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

    const face = normalizeDeviceRackFace(params.rackFace, params.isFullDepth)
    const candidates = railDeviceFootprints({
      deviceId: params.excludeDeviceId ?? 'new',
      deviceName: 'equipo',
      face,
      unitStart: start,
      heightU,
    })

    const mounted = await this.racks.findMountedDevices(rackId)
    for (const other of mounted) {
      if (params.excludeDeviceId && other.id === params.excludeDeviceId) continue
      if (other.supportedByAccessoryId) continue
      if (other.rackUnitStart == null) continue
      const otherFace = normalizeDeviceRackFace(
        other.rackFace,
        !!other.deviceTemplate?.isFullDepth
      )
      const otherFps = railDeviceFootprints({
        deviceId: other.id,
        deviceName: other.name,
        face: otherFace,
        unitStart: other.rackUnitStart,
        heightU: Math.max(1, other.deviceTemplate?.rackUnits ?? 1),
      })
      for (const candidate of candidates) {
        for (const otherFp of otherFps) {
          if (footprintsOverlap(candidate, otherFp)) {
            throw new Exception(
              `Solape con "${other.name}" (U${otherFp.unitStart}–U${otherFp.unitEnd}, ${otherFp.face})`,
              { status: 409 }
            )
          }
        }
      }
    }

    const shelves = await this.accessories.findByRack(rackId)
    for (const shelf of shelves) {
      const shelfFps = shelfFootprints({
        accessoryId: shelf.id,
        accessoryName: shelf.name,
        unitStart: shelf.unitStart,
        heightU: shelf.heightU,
        mountType: shelf.mountType,
      })
      for (const candidate of candidates) {
        for (const otherFp of shelfFps) {
          if (footprintsOverlap(candidate, otherFp)) {
            throw new Exception(
              `Solape con bandeja "${shelf.name}" (U${shelf.unitStart}–U${shelf.unitStart + shelf.heightU - 1}, ${shelf.mountType === 'four_post' ? 'integral' : 'frontal'})`,
              { status: 409 }
            )
          }
        }
      }
    }

    const shelfDevices = await this.accessories.findShelfDevicesByRack(
      rackId,
      params.excludeDeviceId
    )
    for (const device of shelfDevices) {
      const shelf = device.supportedByAccessory
      if (!shelf) continue
      const deviceHeight = shelfDeviceHeightU(device.shelfHeightU, device.deviceTemplate?.rackUnits)
      const deviceFace = resolveShelfDeviceFace(
        shelf.mountType,
        device.rackFace as DeviceRackFace | null,
        !!device.deviceTemplate?.isFullDepth
      )
      const deviceFps = shelfDeviceFootprints({
        deviceId: device.id,
        deviceName: device.name,
        shelfUnitStart: shelf.unitStart,
        face: deviceFace,
        heightU: deviceHeight,
        shelfSlotStart: device.shelfSlotStart ?? 0,
        shelfWidthSlots: device.shelfWidthSlots ?? 1,
      })
      for (const candidate of candidates) {
        for (const otherFp of deviceFps) {
          if (footprintsOverlap(candidate, otherFp)) {
            throw new Exception(
              `Solape con equipo apoyado "${device.name}" (U${otherFp.unitStart}–U${otherFp.unitEnd})`,
              { status: 409 }
            )
          }
        }
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
