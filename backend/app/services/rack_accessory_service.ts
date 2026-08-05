import { Exception } from '@adonisjs/core/exceptions'
import RackAccessoryRepository from '#repositories/rack_accessory_repository'
import RackAccessoryTemplateRepository from '#repositories/rack_accessory_template_repository'
import RackRepository from '#repositories/rack_repository'
import type {
  AccessoryKind,
  CreateRackAccessoryInput,
  RackAccessoryFilters,
  RackFace,
  ShelfMountType,
  UpdateRackAccessoryInput,
} from '#dtos/rack_accessory_dto'
import {
  CHASSIS_HEIGHT_U_DEFAULT,
  DEVICE_SLOT_COUNT_DEFAULT,
  HANG_HEIGHT_U_DEFAULT,
  accessoryHostsDevices,
  accessoryUsesFace,
  facesForMountType,
  maxHeightForAccessoryKind,
  normalizeDeviceSlotCount,
  resolveDeviceSlotCount,
} from '#dtos/rack_accessory_dto'
import type { DeviceRackFace } from '#dtos/rack_dto'
import {
  facesForDeviceRackFace,
  footprintsOverlap,
  normalizeAccessoryHorizontalSlots,
  railDeviceFootprints,
  rangesOverlap,
  resolveHangDeviceFace,
  resolveShelfDeviceFace,
  shelfDeviceFootprints,
  shelfDeviceHeightU,
  shelfFootprints,
  RACK_HORIZONTAL_COLUMNS,
} from '#services/rack_layout'

function assertHorizontalFits(slotStart: number, widthSlots: number) {
  if (slotStart + widthSlots > RACK_HORIZONTAL_COLUMNS) {
    throw new Exception(
      `La huella horizontal (inicio ${slotStart + 1}, ancho ${widthSlots}) no cabe en ${RACK_HORIZONTAL_COLUMNS} columnas`,
      { status: 422 }
    )
  }
}

function assertHeightForKind(kind: AccessoryKind, heightU: number) {
  const max = maxHeightForAccessoryKind(kind)
  if (heightU < 1 || heightU > max) {
    throw new Exception(
      `La altura del ${accessoryLabel(kind)} debe ser entre 1 y ${max}U`,
      { status: 422 }
    )
  }
}

function assertKindFace(kind: AccessoryKind, face: RackFace | null | undefined) {
  if (accessoryUsesFace(kind)) {
    if (face !== 'front' && face !== 'rear') {
      throw new Exception(
        kind === 'chassis'
          ? 'El ordenador / chasis requiere cara front o rear'
          : 'El accesorio colgante requiere cara front o rear',
        { status: 422 }
      )
    }
    return
  }
  if (face != null) {
    throw new Exception('Las bandejas no usan el campo face (usar mountType)', { status: 422 })
  }
}

function accessoryLabel(kind: AccessoryKind) {
  if (kind === 'hang') return 'accesorio'
  if (kind === 'chassis') return 'ordenador'
  return 'bandeja'
}

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
    let kind: AccessoryKind = data.kind ?? 'shelf'
    let heightU = data.heightU
    let mountType = data.mountType
    let manufacturer = data.manufacturer ?? null
    let model = data.model ?? null
    let name = data.name
    let horizontalSlotStart = data.horizontalSlotStart
    let horizontalWidthSlots = data.horizontalWidthSlots
    let deviceSlotCount = data.deviceSlotCount
    let face: RackFace | null = data.face ?? null

    if (data.accessoryTemplateId) {
      const tpl = await this.templates.findActive(data.accessoryTemplateId)
      if (!tpl) {
        throw new Exception('La plantilla de accesorio no existe', { status: 422 })
      }
      kind = tpl.kind
      if (manufacturer == null) manufacturer = tpl.manufacturer
      if (model == null) model = tpl.model
      if (!name?.trim()) name = tpl.name
      if (horizontalSlotStart === undefined) horizontalSlotStart = tpl.horizontalSlotStart
      if (horizontalWidthSlots === undefined) horizontalWidthSlots = tpl.horizontalWidthSlots
      if (deviceSlotCount === undefined) deviceSlotCount = tpl.deviceSlotCount
      if (data.face === undefined && accessoryUsesFace(kind)) face = tpl.face
      if (data.mountType === undefined) mountType = tpl.defaultMountType
      if (data.heightU === undefined || data.heightU == null) {
        heightU = tpl.heightU
      }
    }

    if (accessoryUsesFace(kind)) {
      face = face === 'rear' ? 'rear' : 'front'
      mountType = 'front_only'
      if (heightU == null) {
        heightU = kind === 'chassis' ? CHASSIS_HEIGHT_U_DEFAULT : HANG_HEIGHT_U_DEFAULT
      }
    } else {
      face = null
    }

    if (kind === 'chassis') {
      horizontalSlotStart = 0
      horizontalWidthSlots = 6
    }

    assertKindFace(kind, face)
    assertHeightForKind(kind, heightU)
    const slots = resolveDeviceSlotCount(kind, deviceSlotCount ?? DEVICE_SLOT_COUNT_DEFAULT)

    const horiz = normalizeAccessoryHorizontalSlots(horizontalSlotStart, horizontalWidthSlots)
    assertHorizontalFits(horiz.slotStart, horiz.widthSlots)

    await this.assertPlacement({
      projectId: data.projectId,
      rackId: data.rackId,
      kind,
      unitStart: data.unitStart,
      heightU,
      mountType,
      face,
      horizontalSlotStart: horiz.slotStart,
      horizontalWidthSlots: horiz.widthSlots,
    })

    const row = await this.accessories.create({
      ...data,
      kind,
      name,
      heightU,
      mountType,
      deviceSlotCount: slots,
      face,
      horizontalSlotStart: horiz.slotStart,
      horizontalWidthSlots: horiz.widthSlots,
      manufacturer,
      model,
      createdBy: actorId,
      updatedBy: actorId,
    })
    return this.accessories.findByIdOrFail(row.id)
  }

  async update(id: string, data: UpdateRackAccessoryInput, actorId: string) {
    const existing = await this.accessories.findSummaryOrFail(id)
    const kind = existing.kind as AccessoryKind
    const unitStart = data.unitStart ?? existing.unitStart
    const heightU = data.heightU ?? existing.heightU
    const mountType = (data.mountType ?? existing.mountType) as ShelfMountType
    let face: RackFace | null =
      data.face !== undefined ? data.face : (existing.face as RackFace | null)
    if (accessoryUsesFace(kind)) {
      face = face === 'rear' ? 'rear' : 'front'
    } else {
      face = null
    }
    assertKindFace(kind, face)
    assertHeightForKind(kind, heightU)

    const deviceSlotCount = resolveDeviceSlotCount(
      kind,
      data.deviceSlotCount ?? existing.deviceSlotCount ?? DEVICE_SLOT_COUNT_DEFAULT
    )
    let horiz = normalizeAccessoryHorizontalSlots(
      data.horizontalSlotStart ?? existing.horizontalSlotStart,
      data.horizontalWidthSlots ?? existing.horizontalWidthSlots
    )
    if (kind === 'chassis') {
      horiz = normalizeAccessoryHorizontalSlots(0, 6)
    }
    assertHorizontalFits(horiz.slotStart, horiz.widthSlots)

    if (
      data.unitStart !== undefined ||
      data.heightU !== undefined ||
      data.mountType !== undefined ||
      data.face !== undefined ||
      data.horizontalSlotStart !== undefined ||
      data.horizontalWidthSlots !== undefined ||
      data.deviceSlotCount !== undefined
    ) {
      if (horiz.widthSlots < RACK_HORIZONTAL_COLUMNS && accessoryHostsDevices(kind)) {
        const supported = await this.accessories.countSupportedDevices(id)
        if (supported > 0) {
          throw new Exception(
            `No se puede reducir el ancho: hay equipos montados. Solo accesorios de ancho completo (6/6) admiten equipos.`,
            { status: 409 }
          )
        }
      }

      if (
        accessoryHostsDevices(kind) &&
        data.deviceSlotCount !== undefined &&
        deviceSlotCount < existing.deviceSlotCount
      ) {
        const supported = await this.accessories.findDevicesOnAccessory(id)
        for (const d of supported) {
          const end = (d.shelfSlotStart ?? 0) + (d.shelfWidthSlots ?? 1) - 1
          if (end >= deviceSlotCount) {
            throw new Exception(
              `No se puede reducir la capacidad a ${deviceSlotCount}: el equipo "${d.name}" usa slots fuera de rango`,
              { status: 409 }
            )
          }
        }
      }

      if (kind === 'hang' && data.heightU !== undefined && heightU < existing.heightU) {
        const supported = await this.accessories.findDevicesOnAccessory(id)
        for (const d of supported) {
          const h = shelfDeviceHeightU(d.shelfHeightU, d.deviceTemplate?.rackUnits)
          if (h > heightU) {
            throw new Exception(
              `No se puede reducir la altura a ${heightU}U: el equipo "${d.name}" mide ${h}U`,
              { status: 409 }
            )
          }
        }
      }

      await this.assertPlacement({
        projectId: existing.projectId,
        rackId: existing.rackId,
        kind,
        unitStart,
        heightU,
        mountType: accessoryUsesFace(kind) ? 'front_only' : mountType,
        face,
        horizontalSlotStart: horiz.slotStart,
        horizontalWidthSlots: horiz.widthSlots,
        excludeAccessoryId: id,
      })
    }

    await this.accessories.update(existing, {
      ...data,
      mountType: accessoryUsesFace(kind) ? 'front_only' : mountType,
      deviceSlotCount,
      face,
      horizontalSlotStart: horiz.slotStart,
      horizontalWidthSlots: horiz.widthSlots,
      updatedBy: actorId,
    })
    return this.accessories.findByIdOrFail(id)
  }

  async delete(id: string, actorId: string) {
    const row = await this.accessories.findSummaryOrFail(id)
    const count = await this.accessories.countSupportedDevices(id)
    if (count > 0) {
      throw new Exception(
        `No se puede eliminar el ${accessoryLabel(row.kind)}: hay ${count} equipo(s) montado(s). Quitálos primero.`,
        { status: 409 }
      )
    }
    await this.accessories.softDelete(row, actorId)
  }

  /**
   * Validate accessory placement against rack height, rail devices,
   * other accessories and hosted-device footprints.
   */
  async assertPlacement(params: {
    projectId: string
    rackId: string
    kind: AccessoryKind
    unitStart: number
    heightU: number
    mountType: ShelfMountType
    face?: RackFace | null
    horizontalSlotStart?: number
    horizontalWidthSlots?: number
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
        `El ${accessoryLabel(params.kind)} (${heightU}U desde U${start}) no cabe en el rack de ${rack.heightU}U`,
        { status: 422 }
      )
    }

    const horiz = normalizeAccessoryHorizontalSlots(
      params.horizontalSlotStart,
      params.horizontalWidthSlots
    )
    assertHorizontalFits(horiz.slotStart, horiz.widthSlots)

    const candidates = shelfFootprints({
      accessoryId: params.excludeAccessoryId ?? 'new',
      accessoryName: accessoryLabel(params.kind),
      kind: params.kind,
      unitStart: start,
      heightU,
      mountType: params.mountType,
      face: params.face,
      horizontalSlotStart: horiz.slotStart,
      horizontalWidthSlots: horiz.widthSlots,
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
        kind: other.kind,
        unitStart: other.unitStart,
        heightU: other.heightU,
        mountType: other.mountType,
        face: other.face,
        horizontalSlotStart: other.horizontalSlotStart,
        horizontalWidthSlots: other.horizontalWidthSlots,
      })
      for (const fp of candidates) {
        for (const otherFp of otherFps) {
          if (footprintsOverlap(fp, otherFp)) {
            throw new Exception(
              `Solape con ${accessoryLabel(other.kind)} "${other.name}" (U${other.unitStart}–U${other.unitStart + other.heightU - 1})`,
              { status: 409 }
            )
          }
        }
      }
    }

    const shelfDevices = await this.accessories.findShelfDevicesByRack(params.rackId)
    for (const device of shelfDevices) {
      const host = device.supportedByAccessory
      if (!host) continue
      if (params.excludeAccessoryId && host.id === params.excludeAccessoryId) continue
      const maxH = host.kind === 'hang' ? host.heightU : null
      const deviceHeight = shelfDeviceHeightU(
        device.shelfHeightU,
        device.deviceTemplate?.rackUnits,
        maxH
      )
      const deviceFace =
        host.kind === 'hang'
          ? resolveHangDeviceFace(host.face)
          : resolveShelfDeviceFace(
              host.mountType,
              device.rackFace as DeviceRackFace | null,
              !!device.deviceTemplate?.isFullDepth
            )
      const deviceFps = shelfDeviceFootprints({
        deviceId: device.id,
        deviceName: device.name,
        shelfUnitStart: host.unitStart,
        face: deviceFace,
        heightU: deviceHeight,
        shelfSlotStart: device.shelfSlotStart ?? 0,
        shelfWidthSlots: device.shelfWidthSlots ?? 1,
        deviceSlotCount: host.deviceSlotCount,
      })
      for (const fp of candidates) {
        for (const otherFp of deviceFps) {
          if (footprintsOverlap(fp, otherFp)) {
            throw new Exception(
              `Solape con equipo montado "${device.name}" (U${otherFp.unitStart}–U${otherFp.unitEnd})`,
              { status: 409 }
            )
          }
        }
      }
    }
  }

  /**
   * Place a device on a shelf or hang accessory (horizontal slots + vertical height U + face).
   * Clears rail mount fields. Capacity is per face (four_post shelves have independent front/rear).
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
      throw new Exception('El accesorio no pertenece al proyecto o no existe', { status: 422 })
    }
    if (!accessoryHostsDevices(accessory.kind)) {
      throw new Exception(
        accessory.kind === 'chassis'
          ? 'El ordenador / chasis no admite montar equipos encima ni colgados'
          : 'Solo se pueden montar equipos en bandejas o accesorios colgantes',
        { status: 422 }
      )
    }

    const accessoryHoriz = normalizeAccessoryHorizontalSlots(
      accessory.horizontalSlotStart,
      accessory.horizontalWidthSlots
    )
    if (accessoryHoriz.widthSlots < RACK_HORIZONTAL_COLUMNS) {
      throw new Exception(
        'Solo se pueden montar equipos en accesorios de ancho completo (6/6 columnas)',
        { status: 422 }
      )
    }

    const slotCount = normalizeDeviceSlotCount(accessory.deviceSlotCount)
    const width = Math.round(params.shelfWidthSlots)
    const start = Math.round(params.shelfSlotStart)
    if (width < 1 || width > slotCount) {
      throw new Exception(
        `shelfWidthSlots debe ser entre 1 y ${slotCount} (capacidad del accesorio)`,
        { status: 422 }
      )
    }
    if (start < 0 || start >= slotCount) {
      throw new Exception(`shelfSlotStart debe ser 0..${slotCount - 1}`, { status: 422 })
    }
    const end = start + width - 1
    if (end >= slotCount) {
      throw new Exception(
        `El equipo no cabe en el ancho del accesorio (${slotCount} slots)`,
        { status: 422 }
      )
    }

    let rackFace: DeviceRackFace
    if (accessory.kind === 'hang') {
      if (params.isFullDepth || params.rackFace === 'both') {
        throw new Exception(
          'Los equipos full-depth no se pueden colgar en un accesorio de una sola cara',
          { status: 422 }
        )
      }
      rackFace = resolveHangDeviceFace(accessory.face)
      if (params.rackFace != null && params.rackFace !== rackFace) {
        throw new Exception(
          `Este accesorio está en cara ${rackFace}; no admite equipos en ${params.rackFace}`,
          { status: 422 }
        )
      }
    } else {
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
      rackFace = resolveShelfDeviceFace(
        accessory.mountType,
        params.rackFace,
        params.isFullDepth
      )
    }

    const maxHeight = accessory.kind === 'hang' ? accessory.heightU : null
    let heightU = shelfDeviceHeightU(params.shelfHeightU, params.templateRackUnits, maxHeight)
    if (accessory.kind === 'hang') {
      const requested =
        params.shelfHeightU != null && params.shelfHeightU >= 1
          ? Math.round(params.shelfHeightU)
          : (params.templateRackUnits ?? 1)
      if (requested > accessory.heightU) {
        throw new Exception(
          `El equipo (${requested}U) no puede superar la altura del accesorio (${accessory.heightU}U)`,
          { status: 422 }
        )
      }
      heightU = Math.min(requested, accessory.heightU)
    }

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
      deviceSlotCount: slotCount,
    })

    const others = await this.accessories.findDevicesOnAccessory(
      accessory.id,
      params.excludeDeviceId
    )
    const candidateFaces = new Set(facesForDeviceRackFace(rackFace))
    for (const other of others) {
      const otherFace =
        accessory.kind === 'hang'
          ? resolveHangDeviceFace(accessory.face)
          : resolveShelfDeviceFace(
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
          `Solape en ${accessoryLabel(accessory.kind)} (${rackFace}) con "${other.name}" (slots ${otherStart}–${otherEnd})`,
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

    const hosts = await this.accessories.findByRack(accessory.rackId)
    for (const host of hosts) {
      if (host.id === accessory.id) continue
      const hostFps = shelfFootprints({
        accessoryId: host.id,
        accessoryName: host.name,
        kind: host.kind,
        unitStart: host.unitStart,
        heightU: host.heightU,
        mountType: host.mountType,
        face: host.face,
        horizontalSlotStart: host.horizontalSlotStart,
        horizontalWidthSlots: host.horizontalWidthSlots,
      })
      for (const fp of candidates) {
        for (const otherFp of hostFps) {
          if (footprintsOverlap(fp, otherFp)) {
            throw new Exception(
              `Solape con ${accessoryLabel(host.kind)} "${host.name}" (U${host.unitStart}–U${host.unitStart + host.heightU - 1})`,
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
      const host = device.supportedByAccessory
      if (!host || host.id === accessory.id) continue
      const maxH = host.kind === 'hang' ? host.heightU : null
      const deviceHeight = shelfDeviceHeightU(
        device.shelfHeightU,
        device.deviceTemplate?.rackUnits,
        maxH
      )
      const deviceFace =
        host.kind === 'hang'
          ? resolveHangDeviceFace(host.face)
          : resolveShelfDeviceFace(
              host.mountType,
              device.rackFace as DeviceRackFace | null,
              !!device.deviceTemplate?.isFullDepth
            )
      const deviceFps = shelfDeviceFootprints({
        deviceId: device.id,
        deviceName: device.name,
        shelfUnitStart: host.unitStart,
        face: deviceFace,
        heightU: deviceHeight,
        shelfSlotStart: device.shelfSlotStart ?? 0,
        shelfWidthSlots: device.shelfWidthSlots ?? 1,
        deviceSlotCount: host.deviceSlotCount,
      })
      for (const fp of candidates) {
        for (const otherFp of deviceFps) {
          if (footprintsOverlap(fp, otherFp)) {
            throw new Exception(
              `Solape con equipo montado "${device.name}" (U${otherFp.unitStart}–U${otherFp.unitEnd})`,
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
