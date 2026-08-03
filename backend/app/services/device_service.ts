import { Exception } from '@adonisjs/core/exceptions'
import type Device from '#models/device'
import DeviceRepository from '#repositories/device_repository'
import DeviceTemplateService from '#services/device_template_service'
import SiteService from '#services/site_service'
import RackService from '#services/rack_service'
import RackAccessoryService from '#services/rack_accessory_service'
import type { CreateDeviceInput, DeviceFilters, UpdateDeviceInput } from '#dtos/device_dto'

function isInternetCloudDeviceTypeName(name: string | null | undefined): boolean {
  const t = (name ?? '').trim().toLowerCase()
  if (!t) return false
  return (
    t === 'internet' ||
    t === 'internet service provider' ||
    t === 'isp' ||
    t === 'nube' ||
    t === 'cloud' ||
    t.includes('internet')
  )
}

export default class DeviceService {
  private devices = new DeviceRepository()
  private templates = new DeviceTemplateService()
  private sites = new SiteService()
  private racks = new RackService()
  private accessories = new RackAccessoryService()

  async getAllByProject(projectId: string, filters?: DeviceFilters) {
    return this.devices.findAllByProject(projectId, filters)
  }

  async getById(id: string) {
    return this.devices.findByIdOrFail(id)
  }

  async getActiveSummary(id: string) {
    return this.devices.findActiveSummaryOrFail(id)
  }

  private async ensureInternetGeneralPort(device: Device) {
    await this.devices.loadPorts(device)
    if ((device.ports?.length ?? 0) > 0) return
    await this.devices.createPort({
      deviceId: device.id,
      name: 'Internet',
      portNumber: 1,
      portType: 'wan',
      status: 'up',
      description: 'Puerto general de enlace a Internet (invisible en el diagrama)',
    })
  }

  async create(data: CreateDeviceInput, actorId: string) {
    const template = await this.templates.getActiveWithPorts(data.deviceTemplateId)

    const heightU = Math.max(1, template.rackUnits ?? 1)
    let siteId = data.siteId ?? null
    let areaId = data.areaId ?? null
    let rackId: string | null = data.rackId ?? null
    let rackUnitStart: number | null = data.rackUnitStart ?? null
    let rackFace = data.rackFace ?? null
    let supportedByAccessoryId: string | null = data.supportedByAccessoryId ?? null
    let shelfSlotStart: number | null = data.shelfSlotStart ?? null
    let shelfWidthSlots: number | null = data.shelfWidthSlots ?? null
    let shelfHeightU: number | null = data.shelfHeightU ?? null

    if (supportedByAccessoryId) {
      const shelf = await this.accessories.resolveShelfPlacement({
        projectId: data.projectId,
        accessoryId: supportedByAccessoryId,
        shelfSlotStart: shelfSlotStart ?? 0,
        shelfWidthSlots: shelfWidthSlots ?? 1,
        shelfHeightU,
        templateRackUnits: template.rackUnits,
        rackFace,
        isFullDepth: !!template.isFullDepth,
      })
      supportedByAccessoryId = shelf.supportedByAccessoryId
      shelfSlotStart = shelf.shelfSlotStart
      shelfWidthSlots = shelf.shelfWidthSlots
      shelfHeightU = shelf.shelfHeightU
      rackId = shelf.rackId
      siteId = shelf.siteId
      areaId = shelf.areaId
      rackUnitStart = null
      rackFace = shelf.rackFace
    } else if (rackId) {
      const mount = await this.racks.resolveRackPlacement({
        projectId: data.projectId,
        rackId,
        rackUnitStart,
        rackFace,
        heightU,
        isFullDepth: !!template.isFullDepth,
      })
      rackId = mount.rackId
      rackUnitStart = mount.rackUnitStart
      rackFace = mount.rackFace
      siteId = mount.siteId
      areaId = mount.areaId
      supportedByAccessoryId = null
      shelfSlotStart = null
      shelfWidthSlots = null
      shelfHeightU = null
    } else {
      const placement = await this.sites.resolvePlacement({
        projectId: data.projectId,
        siteId,
        areaId,
      })
      siteId = placement.siteId
      areaId = placement.areaId
      rackUnitStart = null
      rackFace = null
      supportedByAccessoryId = null
      shelfSlotStart = null
      shelfWidthSlots = null
      shelfHeightU = null
    }

    const device = await this.devices.create({
      projectId: data.projectId,
      deviceTypeId: template.deviceTypeId,
      deviceTemplateId: template.id,
      name: data.name,
      hostname: data.hostname ?? null,
      ipAddress: data.ipAddress ?? null,
      macAddress: data.macAddress ?? null,
      manufacturer: template.manufacturer,
      model: template.model,
      serialNumber: data.serialNumber ?? null,
      firmwareVersion: data.firmwareVersion ?? null,
      location: data.location ?? null,
      siteId,
      areaId,
      rackId,
      rackUnitStart,
      rackFace,
      supportedByAccessoryId,
      shelfSlotStart,
      shelfWidthSlots,
      shelfHeightU,
      status: data.status ?? 'unknown',
      notes: data.notes ?? null,
      createdBy: actorId,
      updatedBy: actorId,
    })

    for (const port of template.ports ?? []) {
      const isPassthrough = port.isPassthrough ?? false
      await this.devices.createPort({
        deviceId: device.id,
        name: port.name,
        portNumber: port.portNumber,
        portType: port.portType,
        speed: port.speed,
        status: isPassthrough ? 'up' : 'down',
        description: port.description,
        isPassthrough,
        chassisFace: isPassthrough ? 'front' : (port.chassisFace ?? 'front'),
      })
    }

    await this.devices.loadDeviceType(device)
    if (isInternetCloudDeviceTypeName(device.deviceType?.name)) {
      await this.ensureInternetGeneralPort(device)
    }
    return this.devices.findByIdOrFail(device.id)
  }

  async update(id: string, data: UpdateDeviceInput, actorId: string) {
    const device = await this.devices.findActiveSummaryOrFail(id)
    const projectId = data.projectId ?? device.projectId

    let patch: UpdateDeviceInput = { ...data }

    const nextAccessoryHint =
      data.supportedByAccessoryId !== undefined
        ? data.supportedByAccessoryId
        : device.supportedByAccessoryId

    const touchingShelf =
      data.supportedByAccessoryId !== undefined ||
      data.shelfSlotStart !== undefined ||
      data.shelfWidthSlots !== undefined ||
      data.shelfHeightU !== undefined ||
      (data.rackFace !== undefined && nextAccessoryHint != null)

    const touchingRack =
      data.rackId !== undefined ||
      data.rackUnitStart !== undefined ||
      data.rackFace !== undefined

    if (touchingShelf || (touchingRack && data.supportedByAccessoryId)) {
      const nextAccessoryId = nextAccessoryHint

      if (nextAccessoryId) {
        const shelf = await this.accessories.resolveShelfPlacement({
          projectId,
          accessoryId: nextAccessoryId,
          shelfSlotStart:
            data.shelfSlotStart !== undefined
              ? (data.shelfSlotStart ?? 0)
              : (device.shelfSlotStart ?? 0),
          shelfWidthSlots:
            data.shelfWidthSlots !== undefined
              ? (data.shelfWidthSlots ?? 1)
              : (device.shelfWidthSlots ?? 1),
          shelfHeightU:
            data.shelfHeightU !== undefined ? data.shelfHeightU : device.shelfHeightU,
          templateRackUnits: device.deviceTemplate?.rackUnits,
          rackFace:
            data.rackFace !== undefined ? data.rackFace : device.rackFace,
          isFullDepth: !!device.deviceTemplate?.isFullDepth,
          excludeDeviceId: device.id,
        })
        patch = {
          ...patch,
          supportedByAccessoryId: shelf.supportedByAccessoryId,
          shelfSlotStart: shelf.shelfSlotStart,
          shelfWidthSlots: shelf.shelfWidthSlots,
          shelfHeightU: shelf.shelfHeightU,
          rackId: shelf.rackId,
          rackUnitStart: null,
          rackFace: shelf.rackFace,
          siteId: shelf.siteId,
          areaId: shelf.areaId,
        }
      } else if (data.supportedByAccessoryId === null) {
        // Explicit clear of shelf — may still set rail mount below
        patch = {
          ...patch,
          supportedByAccessoryId: null,
          shelfSlotStart: null,
          shelfWidthSlots: null,
          shelfHeightU: null,
        }
      }
    }

    if (touchingRack && !patch.supportedByAccessoryId) {
      const nextRackId = data.rackId !== undefined ? data.rackId : device.rackId
      if (nextRackId) {
        const template = device.deviceTemplate
        const heightU = Math.max(1, template?.rackUnits ?? 1)
        const mount = await this.racks.resolveRackPlacement({
          projectId,
          rackId: nextRackId,
          rackUnitStart:
            data.rackUnitStart !== undefined ? data.rackUnitStart : device.rackUnitStart,
          rackFace: data.rackFace !== undefined ? data.rackFace : device.rackFace,
          heightU,
          isFullDepth: !!template?.isFullDepth,
          excludeDeviceId: device.id,
        })
        patch = {
          ...patch,
          rackId: mount.rackId,
          rackUnitStart: mount.rackUnitStart,
          rackFace: mount.rackFace,
          siteId: mount.siteId,
          areaId: mount.areaId,
          supportedByAccessoryId: null,
          shelfSlotStart: null,
          shelfWidthSlots: null,
          shelfHeightU: null,
        }
      } else if (data.rackId === null) {
        patch = {
          ...patch,
          rackId: null,
          rackUnitStart: null,
          rackFace: null,
          supportedByAccessoryId: null,
          shelfSlotStart: null,
          shelfWidthSlots: null,
          shelfHeightU: null,
        }
      }
    } else if (
      !touchingShelf &&
      !touchingRack &&
      (data.siteId !== undefined || data.areaId !== undefined)
    ) {
      if (device.rackId || device.supportedByAccessoryId) {
        throw new Exception(
          'El dispositivo está montado en un rack o bandeja; desmontalo antes de cambiar sitio/área manualmente',
          { status: 422 }
        )
      }
      const placement = await this.sites.resolvePlacement({
        projectId,
        siteId: data.siteId !== undefined ? data.siteId : device.siteId,
        areaId: data.areaId !== undefined ? data.areaId : device.areaId,
      })
      patch = { ...patch, ...placement }
    }

    await this.devices.update(device, { ...patch, updatedBy: actorId })
    await this.devices.loadDeviceType(device)
    if (isInternetCloudDeviceTypeName(device.deviceType?.name)) {
      await this.ensureInternetGeneralPort(device)
    }
    return this.devices.findByIdOrFail(id)
  }

  async delete(id: string, actorId: string) {
    const device = await this.devices.findActiveSummaryOrFail(id)
    await this.devices.softDelete(device, actorId)
  }
}
