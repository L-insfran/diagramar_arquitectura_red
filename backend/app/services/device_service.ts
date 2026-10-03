import { Exception } from '@adonisjs/core/exceptions'
import db from '@adonisjs/lucid/services/db'
import type Device from '#models/device'
import Container from '#models/container'
import Area from '#models/area'
import DeviceRepository from '#repositories/device_repository'
import ContainerRepository from '#repositories/container_repository'
import ConnectionDiagramRepository from '#repositories/connection_diagram_repository'
import DeviceTemplateService from '#services/device_template_service'
import SiteService from '#services/site_service'
import RackService from '#services/rack_service'
import BoardService from '#services/board_service'
import RackAccessoryService from '#services/rack_accessory_service'
import DiagramLinkService from '#services/diagram_link_service'
import ConnectionDiagramService from '#services/connection_diagram_service'
import type {
  CreateDeviceInput,
  DeviceFilters,
  DeviceRelocationImpact,
  UpdateDeviceInput,
} from '#dtos/device_dto'

export class DiagramRelocationRequiredError extends Exception {
  static code = 'DIAGRAM_RELOCATION_REQUIRED'
  declare impact: DeviceRelocationImpact

  constructor(impact: DeviceRelocationImpact) {
    super('El cambio de ubicación modifica la ruta del dispositivo en diagramas; se requiere confirmación', {
      status: 409,
      code: DiagramRelocationRequiredError.code,
    })
    this.impact = impact
  }
}

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
  private containers = new ContainerRepository()
  private connectionDiagrams = new ConnectionDiagramRepository()
  private connectionDiagramService = new ConnectionDiagramService()
  private templates = new DeviceTemplateService()
  private sites = new SiteService()
  private racks = new RackService()
  private boards = new BoardService()
  private accessories = new RackAccessoryService()
  private diagramLinks = new DiagramLinkService()

  async listFilterOptions(projectId: string) {
    return this.devices.listFilterOptions(projectId)
  }

  async getAllByProject(projectId: string, filters?: DeviceFilters) {
    return this.devices.findAllByProject(projectId, filters)
  }

  async getPageByProject(projectId: string, filters: DeviceFilters & { page: number }) {
    return this.devices.findPageByProject(projectId, filters)
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
    let containerId: string | null = data.containerId ?? null
    let rackUnitStart: number | null = data.rackUnitStart ?? null
    let rackFace = data.rackFace ?? null
    let boardRow: number | null = data.boardRow ?? null
    let boardCol: number | null = data.boardCol ?? null
    let boardRowSpan: number | null = data.boardRowSpan ?? null
    let boardColSpan: number | null = data.boardColSpan ?? null
    let supportedByAccessoryId: string | null = data.supportedByAccessoryId ?? null
    let shelfSlotStart: number | null = data.shelfSlotStart ?? null
    let shelfWidthSlots: number | null = data.shelfWidthSlots ?? null
    let shelfHeightU: number | null = data.shelfHeightU ?? null

    if (containerId) {
      const container = await Container.query()
        .where('id', containerId)
        .whereNull('deleted_at')
        .first()
      if (!container) {
        throw new Exception('El contenedor no existe o fue eliminado', { status: 422 })
      }

      const wantsBoardMount = boardRow != null && boardCol != null
      const wantsRackMount = rackUnitStart != null
      const softContainerAssign =
        container.kind === 'default' ||
        (container.kind === 'board' && !wantsBoardMount) ||
        (container.kind === 'rack' && !wantsRackMount)

      if (softContainerAssign) {
        const withArea = await Container.query()
          .where('id', containerId)
          .preload('area', (a) => a.preload('site'))
          .firstOrFail()
        siteId = withArea.area?.siteId ?? siteId
        areaId = withArea.areaId
        rackUnitStart = null
        rackFace = null
        supportedByAccessoryId = null
        shelfSlotStart = null
        shelfWidthSlots = null
        shelfHeightU = null
        boardRow = null
        boardCol = null
        boardRowSpan = null
        boardColSpan = null
      } else if (container.kind === 'board') {
        const mount = await this.boards.resolveBoardPlacement({
          projectId: data.projectId,
          containerId,
          boardRow,
          boardCol,
          boardRowSpan,
          boardColSpan,
        })
        containerId = mount.containerId
        boardRow = mount.boardRow
        boardCol = mount.boardCol
        boardRowSpan = mount.boardRowSpan
        boardColSpan = mount.boardColSpan
        siteId = mount.siteId
        areaId = mount.areaId
        rackUnitStart = null
        rackFace = null
        supportedByAccessoryId = null
        shelfSlotStart = null
        shelfWidthSlots = null
        shelfHeightU = null
      } else if (container.kind === 'rack') {
        const mount = await this.racks.resolveRackPlacement({
          projectId: data.projectId,
          rackId: containerId,
          rackUnitStart,
          rackFace,
          heightU,
          isFullDepth: !!template.isFullDepth,
        })
        containerId = mount.rackId
        rackUnitStart = mount.rackUnitStart
        rackFace = mount.rackFace
        siteId = mount.siteId
        areaId = mount.areaId
        supportedByAccessoryId = null
        shelfSlotStart = null
        shelfWidthSlots = null
        shelfHeightU = null
        boardRow = null
        boardCol = null
        boardRowSpan = null
        boardColSpan = null
      }
    } else if (supportedByAccessoryId) {
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
      containerId = shelf.containerId
      siteId = shelf.siteId
      areaId = shelf.areaId
      rackUnitStart = null
      rackFace = shelf.rackFace
      boardRow = null
      boardCol = null
      boardRowSpan = null
      boardColSpan = null
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
      boardRow = null
      boardCol = null
      boardRowSpan = null
      boardColSpan = null
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
      containerId,
      rackUnitStart,
      rackFace,
      boardRow,
      boardCol,
      boardRowSpan,
      boardColSpan,
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
        status: 'up',
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

  async getRelocationImpact(
    deviceId: string,
    targetAreaId: string | null,
    targetContainerId?: string | null,
  ): Promise<DeviceRelocationImpact> {
    const device = await this.devices.findActiveSummaryOrFail(deviceId)
    const placements = await this.connectionDiagrams.findPlacementsForDevice(
      device.projectId,
      deviceId,
    )
    const { linkCodes } = await this.diagramLinks.findActiveLinkCodesByDevice(
      device.projectId,
      deviceId,
    )

    let resolvedAreaId = targetAreaId
    let toContainerId = targetContainerId === undefined ? null : targetContainerId
    let toContainerName: string | null = null
    let toContainerKind: 'default' | 'rack' | 'board' | null = null

    if (toContainerId) {
      const target = await this.containers.findActiveInProject(toContainerId, device.projectId)
      if (!target) {
        throw new Exception('El contenedor no pertenece al proyecto o no existe', { status: 422 })
      }
      resolvedAreaId = target.areaId
      toContainerName = target.name
      toContainerKind = target.kind
    } else if (resolvedAreaId) {
      toContainerName = null
    }

    const fromArea = device.areaId
      ? await Area.query().where('id', device.areaId).whereNull('deleted_at').first()
      : null
    const toArea =
      resolvedAreaId != null
        ? await Area.query().where('id', resolvedAreaId).whereNull('deleted_at').first()
        : null

    const fromContainer = device.containerId
      ? await this.containers.findActiveInProject(device.containerId, device.projectId)
      : null

    const areaChanged = (resolvedAreaId ?? null) !== (device.areaId ?? null)

    const placementMatchesTarget = (p: (typeof placements)[number]) => {
      const key = p.containerKey
      if (toContainerId) {
        if (key === `board:${toContainerId}` || key === `rack:${toContainerId}` || key === `container:${toContainerId}`) {
          return true
        }
        // Default container membership is visual under the area node.
        if (toContainerKind === 'default' && key === `area:${resolvedAreaId}`) {
          return true
        }
        return false
      }
      return key === `area:${resolvedAreaId}`
    }

    const mismatched = placements.filter((p) => !placementMatchesTarget(p))
    const requiresConfirmation = mismatched.length > 0

    const purgeNeeded =
      areaChanged &&
      placements.some((p) => (p.areaId ?? null) !== (resolvedAreaId ?? null))

    return {
      requiresConfirmation,
      mode: purgeNeeded ? 'purge' : 'reparent',
      placements,
      linkCodes: purgeNeeded ? linkCodes : [],
      fromAreaId: device.areaId,
      fromAreaName: fromArea?.name ?? null,
      toAreaId: resolvedAreaId,
      toAreaName: toArea?.name ?? null,
      fromContainerId: device.containerId,
      fromContainerName: fromContainer?.name ?? null,
      toContainerId,
      toContainerName,
    }
  }

  private async purgeDeviceFromDiagrams(projectId: string, deviceId: string, actorId: string) {
    const { linkIds } = await this.diagramLinks.findActiveLinkCodesByDevice(projectId, deviceId)
    await db.transaction(async () => {
      await this.connectionDiagramService.removeDeviceFromAllDiagrams(
        projectId,
        deviceId,
        actorId,
        linkIds,
      )
      if (linkIds.length > 0) {
        await this.diagramLinks.bulkDeleteByDeviceIds(projectId, [deviceId], actorId)
      }
    })
  }

  /**
   * Apply confirmed relocation side-effects then assign, or assign (with diagram reparent) directly.
   */
  private async applyRelocationThenAssign(
    deviceId: string,
    projectId: string,
    impact: DeviceRelocationImpact,
    confirmDiagramRelocate: boolean,
    assignParams: { containerId?: string | null; areaId?: string | null },
    actorId: string,
  ) {
    if (impact.requiresConfirmation && !confirmDiagramRelocate) {
      throw new DiagramRelocationRequiredError(impact)
    }
    if (impact.requiresConfirmation && impact.mode === 'purge' && confirmDiagramRelocate) {
      await this.purgeDeviceFromDiagrams(projectId, deviceId, actorId)
      return this.assignToContainer(deviceId, assignParams, actorId, { syncDiagramLayout: false })
    }
    return this.assignToContainer(deviceId, assignParams, actorId)
  }

  async update(id: string, data: UpdateDeviceInput, actorId: string) {
    const device = await this.devices.findActiveSummaryOrFail(id)
    const projectId = data.projectId ?? device.projectId
    const confirmDiagramRelocate = data.confirmDiagramRelocate === true

    const { confirmDiagramRelocate: _confirmFlag, ...deviceData } = data
    let patch: UpdateDeviceInput = { ...deviceData }

    const providesPhysicalBoard =
      data.boardRow !== undefined ||
      data.boardCol !== undefined ||
      data.boardRowSpan !== undefined ||
      data.boardColSpan !== undefined

    const providesPhysicalRack = data.rackUnitStart !== undefined

    const providesShelf =
      data.supportedByAccessoryId !== undefined ||
      data.shelfSlotStart !== undefined ||
      data.shelfWidthSlots !== undefined ||
      data.shelfHeightU !== undefined

    /** containerId without U/celda/shelf = document location only (same as assign-container). */
    const softContainerUpdate =
      data.containerId !== undefined &&
      !providesPhysicalBoard &&
      !providesPhysicalRack &&
      !providesShelf

    if (softContainerUpdate) {
      if (data.containerId) {
        const target = await this.containers.findActiveInProject(data.containerId, projectId)
        if (!target) {
          throw new Exception('El contenedor no pertenece al proyecto o no existe', { status: 422 })
        }
        const impact = await this.getRelocationImpact(id, target.areaId, data.containerId)
        await this.applyRelocationThenAssign(
          id,
          projectId,
          impact,
          confirmDiagramRelocate,
          { containerId: data.containerId },
          actorId,
        )
      } else {
        const placement = await this.sites.resolvePlacement({
          projectId,
          siteId: deviceData.siteId !== undefined ? deviceData.siteId : device.siteId,
          areaId: deviceData.areaId !== undefined ? deviceData.areaId : device.areaId,
        })
        const impact = await this.getRelocationImpact(id, placement.areaId, null)
        if (impact.requiresConfirmation && !confirmDiagramRelocate) {
          throw new DiagramRelocationRequiredError(impact)
        }
        if (impact.requiresConfirmation && impact.mode === 'purge' && confirmDiagramRelocate) {
          await this.purgeDeviceFromDiagrams(projectId, id, actorId)
        }
        await this.devices.update(device, {
          siteId: placement.siteId,
          areaId: placement.areaId,
          containerId: null,
          rackUnitStart: null,
          rackFace: null,
          boardRow: null,
          boardCol: null,
          boardRowSpan: null,
          boardColSpan: null,
          supportedByAccessoryId: null,
          shelfSlotStart: null,
          shelfWidthSlots: null,
          shelfHeightU: null,
          updatedBy: actorId,
        })
        if (
          placement.areaId &&
          !(impact.requiresConfirmation && impact.mode === 'purge' && confirmDiagramRelocate)
        ) {
          await this.connectionDiagramService.reparentDeviceInDiagrams(
            projectId,
            id,
            { containerId: null, areaId: placement.areaId, containerKind: null },
            actorId,
          )
        }
      }

      const {
        siteId: _s,
        areaId: _a,
        containerId: _c,
        rackUnitStart: _ru,
        rackFace: _rf,
        boardRow: _br,
        boardCol: _bc,
        boardRowSpan: _brs,
        boardColSpan: _bcs,
        supportedByAccessoryId: _sa,
        shelfSlotStart: _ss,
        shelfWidthSlots: _sw,
        shelfHeightU: _sh,
        ...identityPatch
      } = patch
      patch = identityPatch
    }

    const touchingBoard =
      !softContainerUpdate &&
      (data.containerId !== undefined ||
        data.boardRow !== undefined ||
        data.boardCol !== undefined ||
        data.boardRowSpan !== undefined ||
        data.boardColSpan !== undefined)

    const nextAccessoryHint =
      data.supportedByAccessoryId !== undefined
        ? data.supportedByAccessoryId
        : device.supportedByAccessoryId

    const touchingShelf =
      !softContainerUpdate &&
      (data.supportedByAccessoryId !== undefined ||
        data.shelfSlotStart !== undefined ||
        data.shelfWidthSlots !== undefined ||
        data.shelfHeightU !== undefined ||
        (data.rackFace !== undefined && nextAccessoryHint != null))

    const touchingRack =
      !softContainerUpdate &&
      (data.containerId !== undefined ||
        data.rackUnitStart !== undefined ||
        data.rackFace !== undefined)

    if (touchingBoard) {
      const nextContainerId = data.containerId !== undefined ? data.containerId : device.containerId
      if (nextContainerId) {
        const container = await Container.query()
          .where('id', nextContainerId)
          .whereNull('deleted_at')
          .first()

        if (container?.kind === 'board') {
          const mount = await this.boards.resolveBoardPlacement({
            projectId,
            containerId: nextContainerId,
            boardRow: data.boardRow !== undefined ? data.boardRow : device.boardRow,
            boardCol: data.boardCol !== undefined ? data.boardCol : device.boardCol,
            boardRowSpan:
              data.boardRowSpan !== undefined ? data.boardRowSpan : device.boardRowSpan,
            boardColSpan:
              data.boardColSpan !== undefined ? data.boardColSpan : device.boardColSpan,
            excludeDeviceId: device.id,
          })
          patch = {
            ...patch,
            containerId: mount.containerId,
            boardRow: mount.boardRow,
            boardCol: mount.boardCol,
            boardRowSpan: mount.boardRowSpan,
            boardColSpan: mount.boardColSpan,
            siteId: mount.siteId,
            areaId: mount.areaId,
            rackUnitStart: null,
            rackFace: null,
            supportedByAccessoryId: null,
            shelfSlotStart: null,
            shelfWidthSlots: null,
            shelfHeightU: null,
          }
        }
      } else if (data.containerId === null) {
        patch = {
          ...patch,
          containerId: null,
          boardRow: null,
          boardCol: null,
          boardRowSpan: null,
          boardColSpan: null,
        }
      }
    }

    if (
      !patch.containerId &&
      (touchingShelf || (touchingRack && data.supportedByAccessoryId))
    ) {
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
          rackFace: data.rackFace !== undefined ? data.rackFace : device.rackFace,
          isFullDepth: !!device.deviceTemplate?.isFullDepth,
          excludeDeviceId: device.id,
        })
        patch = {
          ...patch,
          supportedByAccessoryId: shelf.supportedByAccessoryId,
          shelfSlotStart: shelf.shelfSlotStart,
          shelfWidthSlots: shelf.shelfWidthSlots,
          shelfHeightU: shelf.shelfHeightU,
          containerId: shelf.containerId,
          rackUnitStart: null,
          rackFace: shelf.rackFace,
          siteId: shelf.siteId,
          areaId: shelf.areaId,
          boardRow: null,
          boardCol: null,
          boardRowSpan: null,
          boardColSpan: null,
        }
      } else if (data.supportedByAccessoryId === null) {
        patch = {
          ...patch,
          supportedByAccessoryId: null,
          shelfSlotStart: null,
          shelfWidthSlots: null,
          shelfHeightU: null,
        }
      }
    }

    if (touchingRack && !patch.supportedByAccessoryId && !patch.containerId) {
      const nextContainerId = data.containerId !== undefined ? data.containerId : device.containerId
      if (nextContainerId) {
        const container = await Container.query()
          .where('id', nextContainerId)
          .whereNull('deleted_at')
          .first()

        if (container?.kind === 'rack') {
          const tmpl = device.deviceTemplate
          const heightU = Math.max(1, tmpl?.rackUnits ?? 1)
          const mount = await this.racks.resolveRackPlacement({
            projectId,
            rackId: nextContainerId,
            rackUnitStart:
              data.rackUnitStart !== undefined ? data.rackUnitStart : device.rackUnitStart,
            rackFace: data.rackFace !== undefined ? data.rackFace : device.rackFace,
            heightU,
            isFullDepth: !!tmpl?.isFullDepth,
            excludeDeviceId: device.id,
          })
          patch = {
            ...patch,
            containerId: mount.rackId,
            rackUnitStart: mount.rackUnitStart,
            rackFace: mount.rackFace,
            siteId: mount.siteId,
            areaId: mount.areaId,
            supportedByAccessoryId: null,
            shelfSlotStart: null,
            shelfWidthSlots: null,
            shelfHeightU: null,
            boardRow: null,
            boardCol: null,
            boardRowSpan: null,
            boardColSpan: null,
          }
        }
      } else if (data.containerId === null) {
        patch = {
          ...patch,
          containerId: null,
          rackUnitStart: null,
          rackFace: null,
          supportedByAccessoryId: null,
          shelfSlotStart: null,
          shelfWidthSlots: null,
          shelfHeightU: null,
        }
      }
    } else if (
      !softContainerUpdate &&
      !touchingBoard &&
      !touchingShelf &&
      !touchingRack &&
      (deviceData.siteId !== undefined || deviceData.areaId !== undefined)
    ) {
      const isPhysicallyMounted =
        device.rackUnitStart != null ||
        device.boardRow != null ||
        device.supportedByAccessoryId != null
      if (isPhysicallyMounted) {
        throw new Exception(
          'El dispositivo está montado en un rack, bandeja o tablero; desmontalo antes de cambiar sitio/área manualmente',
          { status: 422 }
        )
      }
      const placement = await this.sites.resolvePlacement({
        projectId,
        siteId: deviceData.siteId !== undefined ? deviceData.siteId : device.siteId,
        areaId: deviceData.areaId !== undefined ? deviceData.areaId : device.areaId,
      })

      const impact = await this.getRelocationImpact(id, placement.areaId, null)
      if (impact.requiresConfirmation && !confirmDiagramRelocate) {
        throw new DiagramRelocationRequiredError(impact)
      }
      if (impact.requiresConfirmation && impact.mode === 'purge' && confirmDiagramRelocate) {
        await this.purgeDeviceFromDiagrams(projectId, id, actorId)
      }

      if (placement.areaId) {
        await this.assignToContainer(
          id,
          { areaId: placement.areaId },
          actorId,
          {
            syncDiagramLayout: !(
              impact.requiresConfirmation &&
              impact.mode === 'purge' &&
              confirmDiagramRelocate
            ),
          },
        )
        const {
          siteId: _s,
          areaId: _a,
          containerId: _c,
          ...rest
        } = patch
        patch = rest
      } else {
        patch = { ...patch, ...placement, containerId: null }
      }
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
    await this.diagramLinks.softDeleteByDeviceId(id, actorId)
    await this.devices.softDelete(device, actorId)
  }

  /**
   * Assign device to a container without rack U / board cell coordinates.
   * Syncs site_id and area_id from the target container's area.
   * By default reparents the device in all connection-diagram layouts to match.
   */
  async assignToContainer(
    deviceId: string,
    params: { containerId?: string | null; areaId?: string | null },
    actorId: string,
    options?: { syncDiagramLayout?: boolean },
  ) {
    const syncDiagramLayout = options?.syncDiagramLayout !== false
    const device = await this.devices.findActiveSummaryOrFail(deviceId)
    const projectId = device.projectId

    let targetContainerId = params.containerId ?? null
    let targetAreaId = params.areaId ?? null

    if (targetContainerId) {
      const found = await this.containers.findActiveInProject(targetContainerId, projectId)
      if (!found) {
        throw new Exception('El contenedor no pertenece al proyecto o no existe', { status: 422 })
      }
      targetAreaId = found.areaId
    } else if (targetAreaId) {
      const area = await this.containers.findAreaWithSite(targetAreaId)
      if (!area || area.site.projectId !== projectId) {
        throw new Exception('El área no pertenece al proyecto', { status: 422 })
      }
      const defaultContainer = await this.containers.ensureDefaultForArea(
        projectId,
        targetAreaId,
        actorId,
      )
      if (!defaultContainer) {
        throw new Exception('No se pudo resolver el contenedor default del área', { status: 422 })
      }
      targetContainerId = defaultContainer.id
    } else {
      throw new Exception('containerId o areaId es requerido', { status: 422 })
    }

    const container = await this.containers.findActiveInProject(targetContainerId!, projectId)
    if (!container) {
      throw new Exception('Contenedor destino no encontrado', { status: 422 })
    }
    const area = await this.containers.findAreaWithSite(container.areaId)
    if (!area) {
      throw new Exception('El área del contenedor no existe', { status: 422 })
    }

    if (device.containerId === targetContainerId && device.areaId === targetAreaId) {
      if (syncDiagramLayout) {
        await this.connectionDiagramService.reparentDeviceInDiagrams(
          projectId,
          deviceId,
          {
            containerId: targetContainerId,
            areaId: container.areaId,
            containerKind: container.kind,
          },
          actorId,
        )
      }
      return this.devices.findByIdOrFail(deviceId)
    }

    await this.devices.update(device, {
      containerId: targetContainerId,
      areaId: container.areaId,
      siteId: area.siteId,
      rackUnitStart: null,
      rackFace: null,
      boardRow: null,
      boardCol: null,
      boardRowSpan: null,
      boardColSpan: null,
      supportedByAccessoryId: null,
      shelfSlotStart: null,
      shelfWidthSlots: null,
      shelfHeightU: null,
      updatedBy: actorId,
    })

    if (syncDiagramLayout) {
      await this.connectionDiagramService.reparentDeviceInDiagrams(
        projectId,
        deviceId,
        {
          containerId: targetContainerId,
          areaId: container.areaId,
          containerKind: container.kind,
        },
        actorId,
      )
    }

    return this.devices.findByIdOrFail(deviceId)
  }
}
