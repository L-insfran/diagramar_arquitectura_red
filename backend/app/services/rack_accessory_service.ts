import { Exception } from '@adonisjs/core/exceptions'
import RackAccessoryRepository from '#repositories/rack_accessory_repository'
import RackAccessoryTemplateRepository from '#repositories/rack_accessory_template_repository'
import RackRepository from '#repositories/rack_repository'
import type {
  CreateRackAccessoryInput,
  RackAccessoryFilters,
  ShelfMountType,
  UpdateRackAccessoryInput,
} from '#dtos/rack_accessory_dto'
import { facesForMountType } from '#dtos/rack_accessory_dto'
import type { DeviceRackFace } from '#dtos/rack_dto'
import {
  facesForDeviceRackFace,
  footprintsOverlap,
  railDeviceFootprints,
  rangesOverlap,
  resolveShelfDeviceFace,
  shelfDeviceFootprints,
  shelfDeviceHeightU,
  shelfFootprints,
} from '#services/rack_layout'

export default class RackAccessoryService {
  private accessories = new RackAccessoryRepository()
  private templates = new RackAccessoryTemplateRepository()
  private racks = new RackRepository()

  async getAllByProject(projectId: string, filters?: RackAccessoryFilters) {
    return this.accessories.findAllByProject(projectId, filters)
  }

  async getById(id: string) {
    return this.accessories.findByIdOrFail(id)
  }

  async getSummary(id: string) {
    return this.accessories.findSummaryOrFail(id)
  }

  async create(data: CreateRackAccessoryInput, actorId: string) {
    let heightU = data.heightU
    let mountType = data.mountType
    let manufacturer = data.manufacturer ?? null
    let model = data.model ?? null
    let name = data.name

    if (data.accessoryTemplateId) {
      const tpl = await this.templates.findActive(data.accessoryTemplateId)
      if (!tpl) {
        throw new Exception('La plantilla de accesorio no existe', { status: 422 })
      }
      if (manufacturer == null) manufacturer = tpl.manufacturer
      if (model == null) model = tpl.model
      if (!name?.trim()) name = tpl.name
    }

    await this.assertPlacement({
      projectId: data.projectId,
      rackId: data.rackId,
      unitStart: data.unitStart,
      heightU,
      mountType,
    })

    const row = await this.accessories.create({
      ...data,
      name,
      heightU,
      mountType,
      manufacturer,
      model,
      kind: data.kind ?? 'shelf',
      createdBy: actorId,
      updatedBy: actorId,
    })
    return this.accessories.findByIdOrFail(row.id)
  }

  async update(id: string, data: UpdateRackAccessoryInput, actorId: string) {
    const existing = await this.accessories.findSummaryOrFail(id)
    const unitStart = data.unitStart ?? existing.unitStart
    const heightU = (data.heightU ?? existing.heightU) as 1 | 2
    const mountType = (data.mountType ?? existing.mountType) as ShelfMountType

    if (
      data.unitStart !== undefined ||
      data.heightU !== undefined ||
      data.mountType !== undefined
    ) {
      await this.assertPlacement({
        projectId: existing.projectId,
        rackId: existing.rackId,
        unitStart,
        heightU,
        mountType,
        excludeAccessoryId: id,
      })
    }

    await this.accessories.update(existing, { ...data, updatedBy: actorId })
    return this.accessories.findByIdOrFail(id)
  }

  async delete(id: string, actorId: string) {
    const row = await this.accessories.findSummaryOrFail(id)
    const count = await this.accessories.countSupportedDevices(id)
    if (count > 0) {
      throw new Exception(
        `No se puede eliminar la bandeja: hay ${count} equipo(s) apoyado(s). Quitálos primero.`,
        { status: 409 }
      )
    }
    await this.accessories.softDelete(row, actorId)
  }

  /**
   * Validate shelf placement against rack height, rail devices,
   * other accessories and shelf-resting device footprints.
   */
  async assertPlacement(params: {
    projectId: string
    rackId: string
    unitStart: number
    heightU: number
    mountType: ShelfMountType
    excludeAccessoryId?: string
  }) {
    const rack = await this.racks.findActiveInProject(params.rackId, params.projectId)
    if (!rack) {
      throw new Exception('El rack no pertenece al proyecto o no existe', { status: 422 })
    }

    const start = params.unitStart
    const heightU = Math.max(1, params.heightU)
    const end = start + heightU - 1
    if (start < 1 || end > rack.heightU) {
      throw new Exception(
        `La bandeja (${heightU}U desde U${start}) no cabe en el rack de ${rack.heightU}U`,
        { status: 422 }
      )
    }

    const candidates = shelfFootprints({
      accessoryId: params.excludeAccessoryId ?? 'new',
      accessoryName: 'bandeja',
      unitStart: start,
      heightU,
      mountType: params.mountType,
    })

    const mounted = await this.racks.findMountedDevices(params.rackId)
    for (const other of mounted) {
      if (other.supportedByAccessoryId) continue
      if (other.rackUnitStart == null) continue
      const otherFace =
        other.rackFace === 'both' || other.deviceTemplate?.isFullDepth
          ? 'both'
          : ((other.rackFace ?? 'front') as DeviceRackFace)
      const otherFps = railDeviceFootprints({
        deviceId: other.id,
        deviceName: other.name,
        face: otherFace,
        unitStart: other.rackUnitStart,
        heightU: Math.max(1, other.deviceTemplate?.rackUnits ?? 1),
      })
      for (const fp of candidates) {
        for (const otherFp of otherFps) {
          if (footprintsOverlap(fp, otherFp)) {
            throw new Exception(
              `Solape con equipo "${other.name}" (U${otherFp.unitStart}–U${otherFp.unitEnd}, ${otherFp.face})`,
              { status: 409 }
            )
          }
        }
      }
    }

    const accessories = await this.accessories.findByRack(params.rackId)
    for (const other of accessories) {
      if (params.excludeAccessoryId && other.id === params.excludeAccessoryId) continue
      const otherFps = shelfFootprints({
        accessoryId: other.id,
        accessoryName: other.name,
        unitStart: other.unitStart,
        heightU: other.heightU,
        mountType: other.mountType,
      })
      for (const fp of candidates) {
        for (const otherFp of otherFps) {
          if (footprintsOverlap(fp, otherFp)) {
            throw new Exception(
              `Solape con bandeja "${other.name}" (U${other.unitStart}–U${other.unitStart + other.heightU - 1})`,
              { status: 409 }
            )
          }
        }
      }
    }

    const shelfDevices = await this.accessories.findShelfDevicesByRack(params.rackId)
    for (const device of shelfDevices) {
      const shelf = device.supportedByAccessory
      if (!shelf) continue
      if (params.excludeAccessoryId && shelf.id === params.excludeAccessoryId) continue
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
      for (const fp of candidates) {
        for (const otherFp of deviceFps) {
          if (footprintsOverlap(fp, otherFp)) {
            throw new Exception(
              `Solape con equipo apoyado "${device.name}" (U${otherFp.unitStart}–U${otherFp.unitEnd})`,
              { status: 409 }
            )
          }
        }
      }
    }
  }

  /**
   * Place a device on a shelf (horizontal slots + vertical height U + face).
   * Clears rail mount fields. Four-post shelves allow front or rear.
   */
  async resolveShelfPlacement(params: {
    projectId: string
    accessoryId: string
    shelfSlotStart: number
    shelfWidthSlots: number
    shelfHeightU?: number | null
    templateRackUnits?: number | null
    rackFace?: DeviceRackFace | null
    isFullDepth?: boolean
    excludeDeviceId?: string
  }): Promise<{
    supportedByAccessoryId: string
    shelfSlotStart: number
    shelfWidthSlots: number
    shelfHeightU: number
    rackFace: DeviceRackFace
    rackId: string
    siteId: string
    areaId: string
  }> {
    const accessory = await this.accessories.findActiveInProject(
      params.accessoryId,
      params.projectId
    )
    if (!accessory) {
      throw new Exception('La bandeja no pertenece al proyecto o no existe', { status: 422 })
    }
    if (accessory.kind !== 'shelf') {
      throw new Exception('Solo se pueden apoyar equipos en bandejas', { status: 422 })
    }

    const width = params.shelfWidthSlots
    const start = params.shelfSlotStart
    if (width !== 1 && width !== 3) {
      throw new Exception('shelfWidthSlots debe ser 1 (tercio) o 3 (ancho completo)', {
        status: 422,
      })
    }
    if (width === 3 && start !== 0) {
      throw new Exception('Un equipo de ancho completo debe usar slot 0', { status: 422 })
    }
    if (width === 1 && (start < 0 || start > 2)) {
      throw new Exception('shelfSlotStart debe ser 0, 1 o 2', { status: 422 })
    }

    const end = start + width - 1
    if (end > 2) {
      throw new Exception('El equipo no cabe en el ancho de la bandeja (3 tercios)', {
        status: 422,
      })
    }

    const allowedFaces = facesForMountType(accessory.mountType)
    if (
      !params.isFullDepth &&
      params.rackFace !== 'both' &&
      params.rackFace === 'rear' &&
      !allowedFaces.includes('rear')
    ) {
      throw new Exception(
        'Esta bandeja es solo frontal; no admite equipos del lado trasero',
        { status: 422 }
      )
    }
    const rackFace = resolveShelfDeviceFace(
      accessory.mountType,
      params.rackFace,
      params.isFullDepth
    )

    const heightU = shelfDeviceHeightU(params.shelfHeightU, params.templateRackUnits)
    const unitStart = accessory.unitStart
    const unitEnd = unitStart + heightU - 1
    const rack = accessory.rack
    if (unitEnd > rack.heightU) {
      throw new Exception(
        `El equipo (${heightU}U desde U${unitStart}) no cabe en el rack de ${rack.heightU}U`,
        { status: 422 }
      )
    }

    const candidates = shelfDeviceFootprints({
      deviceId: params.excludeDeviceId ?? 'new',
      deviceName: 'equipo',
      shelfUnitStart: unitStart,
      face: rackFace,
      heightU,
      shelfSlotStart: start,
      shelfWidthSlots: width,
    })

    const others = await this.accessories.findDevicesOnAccessory(
      accessory.id,
      params.excludeDeviceId
    )
    const candidateFaces = new Set(facesForDeviceRackFace(rackFace))
    for (const other of others) {
      const otherFace = resolveShelfDeviceFace(
        accessory.mountType,
        other.rackFace as DeviceRackFace | null,
        !!other.deviceTemplate?.isFullDepth
      )
      const sharesFace = facesForDeviceRackFace(otherFace).some((f) => candidateFaces.has(f))
      if (!sharesFace) continue
      const otherStart = other.shelfSlotStart ?? 0
      const otherWidth = other.shelfWidthSlots ?? 1
      const otherEnd = otherStart + otherWidth - 1
      if (rangesOverlap(start, end, otherStart, otherEnd)) {
        throw new Exception(
          `Solape en bandeja (${rackFace}) con "${other.name}" (slots ${otherStart}–${otherEnd})`,
          { status: 409 }
        )
      }
    }

    const mounted = await this.racks.findMountedDevices(accessory.rackId)
    for (const other of mounted) {
      if (params.excludeDeviceId && other.id === params.excludeDeviceId) continue
      if (other.supportedByAccessoryId) continue
      if (other.rackUnitStart == null) continue
      const otherFace =
        other.rackFace === 'both' || other.deviceTemplate?.isFullDepth
          ? 'both'
          : ((other.rackFace ?? 'front') as DeviceRackFace)
      const otherFps = railDeviceFootprints({
        deviceId: other.id,
        deviceName: other.name,
        face: otherFace,
        unitStart: other.rackUnitStart,
        heightU: Math.max(1, other.deviceTemplate?.rackUnits ?? 1),
      })
      for (const fp of candidates) {
        for (const otherFp of otherFps) {
          if (footprintsOverlap(fp, otherFp)) {
            throw new Exception(
              `Solape con equipo "${other.name}" (U${otherFp.unitStart}–U${otherFp.unitEnd}, ${otherFp.face})`,
              { status: 409 }
            )
          }
        }
      }
    }

    const shelves = await this.accessories.findByRack(accessory.rackId)
    for (const shelf of shelves) {
      if (shelf.id === accessory.id) continue
      const shelfFps = shelfFootprints({
        accessoryId: shelf.id,
        accessoryName: shelf.name,
        unitStart: shelf.unitStart,
        heightU: shelf.heightU,
        mountType: shelf.mountType,
      })
      for (const fp of candidates) {
        for (const otherFp of shelfFps) {
          if (footprintsOverlap(fp, otherFp)) {
            throw new Exception(
              `Solape con bandeja "${shelf.name}" (U${shelf.unitStart}–U${shelf.unitStart + shelf.heightU - 1})`,
              { status: 409 }
            )
          }
        }
      }
    }

    const shelfDevices = await this.accessories.findShelfDevicesByRack(
      accessory.rackId,
      params.excludeDeviceId
    )
    for (const device of shelfDevices) {
      const shelf = device.supportedByAccessory
      if (!shelf || shelf.id === accessory.id) continue
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
      for (const fp of candidates) {
        for (const otherFp of deviceFps) {
          if (footprintsOverlap(fp, otherFp)) {
            throw new Exception(
              `Solape con equipo apoyado "${device.name}" (U${otherFp.unitStart}–U${otherFp.unitEnd})`,
              { status: 409 }
            )
          }
        }
      }
    }

    return {
      supportedByAccessoryId: accessory.id,
      shelfSlotStart: start,
      shelfWidthSlots: width,
      shelfHeightU: heightU,
      rackFace,
      rackId: accessory.rackId,
      siteId: rack.area.siteId,
      areaId: rack.areaId,
    }
  }
}
