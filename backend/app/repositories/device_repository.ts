import { DateTime } from 'luxon'
import Device from '#models/device'
import Area from '#models/area'
import DeviceTemplate from '#models/device_template'
import DeviceType from '#models/device_type'
import Port from '#models/port'
import type {
  CreateDeviceInput,
  DeviceFilterOptions,
  DeviceFilters,
  DeviceListPage,
  UpdateDeviceInput,
} from '#dtos/device_dto'

export default class DeviceRepository {
  async listFilterOptions(projectId: string): Promise<DeviceFilterOptions> {
    const [areas, templates] = await Promise.all([
      Area.query()
        .whereNull('deleted_at')
        .whereHas('site', (siteQuery) => {
          siteQuery.where('project_id', projectId).whereNull('deleted_at')
        })
        .orderBy('name', 'asc')
        .select('id', 'name'),
      DeviceTemplate.query()
        .whereNull('deleted_at')
        .whereHas('devices', (deviceQuery) => {
          deviceQuery.where('project_id', projectId).whereNull('deleted_at')
        })
        .orderBy('name', 'asc')
        .select('id', 'name'),
    ])

    return {
      areas: areas.map((area) => ({ id: area.id, name: area.name })),
      templates: templates.map((template) => ({ id: template.id, name: template.name })),
    }
  }

  async findAllByProject(projectId: string, filters?: DeviceFilters) {
    return this.filteredQuery(projectId, filters)
  }

  async findPageByProject(
    projectId: string,
    filters: DeviceFilters & { page: number }
  ): Promise<DeviceListPage<Device>> {
    const perPage = Math.min(100, Math.max(1, filters.perPage ?? 50))
    const paginator = await this.filteredQuery(projectId, filters).paginate(filters.page, perPage)
    return {
      items: paginator.all(),
      total: Number(paginator.total),
      page: paginator.currentPage,
      perPage: paginator.perPage,
    }
  }

  private filteredQuery(projectId: string, filters?: DeviceFilters) {
    const query = Device.query()
      .where('project_id', projectId)
      .whereNull('deleted_at')
      .preload('deviceType')
      .preload('deviceTemplate')
      .preload('site')
      .preload('area')
      .preload('container')
      .preload('supportedByAccessory')
      .orderBy('name', 'asc')

    if (!filters?.summary) {
      query.preload('ports', (q) => q.orderBy('port_number', 'asc').preload('vlans'))
    }

    if (filters?.status) {
      query.where('status', filters.status)
    }
    if (filters?.deviceTypeId) {
      query.where('device_type_id', filters.deviceTypeId)
    }
    if (filters?.deviceTemplateId) {
      query.where('device_template_id', filters.deviceTemplateId)
    }
    if (filters?.siteId) {
      query.where('site_id', filters.siteId)
    }
    if (filters?.areaId) {
      query.where('area_id', filters.areaId)
    }
    if (filters?.containerId) {
      query.where('container_id', filters.containerId)
    }
    if (filters?.search) {
      query.where((q) => {
        q.whereILike('name', `%${filters.search}%`)
          .orWhereILike('ip_address', `%${filters.search}%`)
          .orWhereILike('hostname', `%${filters.search}%`)
      })
    }

    return query
  }

  async findByIdOrFail(id: string) {
    return Device.query()
      .where('id', id)
      .whereNull('deleted_at')
      .preload('deviceType')
      .preload('deviceTemplate')
      .preload('site')
      .preload('area')
      .preload('container')
      .preload('supportedByAccessory')
      .preload('ports', (q) => q.orderBy('port_number', 'asc').preload('vlans'))
      .preload('credentials')
      .preload('employees')
      .firstOrFail()
  }

  /** Lightweight load for authz checks (no heavy preloads). */
  async findActiveSummaryOrFail(id: string) {
    return Device.query()
      .where('id', id)
      .whereNull('deleted_at')
      .preload('deviceType')
      .preload('deviceTemplate')
      .preload('site')
      .preload('area')
      .preload('container')
      .preload('supportedByAccessory')
      .firstOrFail()
  }

  async create(
    data: CreateDeviceInput & {
      deviceTypeId: string
      manufacturer?: string | null
      model?: string | null
      createdBy: string
      updatedBy: string
    }
  ) {
    return Device.create({
      projectId: data.projectId,
      deviceTypeId: data.deviceTypeId,
      deviceTemplateId: data.deviceTemplateId,
      siteId: data.siteId ?? null,
      areaId: data.areaId ?? null,
      containerId: data.containerId ?? null,
      rackUnitStart: data.rackUnitStart ?? null,
      rackFace: data.rackFace ?? null,
      boardRow: data.boardRow ?? null,
      boardCol: data.boardCol ?? null,
      boardRowSpan: data.boardRowSpan ?? null,
      boardColSpan: data.boardColSpan ?? null,
      supportedByAccessoryId: data.supportedByAccessoryId ?? null,
      shelfSlotStart: data.shelfSlotStart ?? null,
      shelfWidthSlots: data.shelfWidthSlots ?? null,
      shelfHeightU: data.shelfHeightU ?? null,
      name: data.name,
      hostname: data.hostname ?? null,
      ipAddress: data.ipAddress ?? null,
      macAddress: data.macAddress ?? null,
      manufacturer: data.manufacturer ?? null,
      model: data.model ?? null,
      serialNumber: data.serialNumber ?? null,
      firmwareVersion: data.firmwareVersion ?? null,
      location: data.location ?? null,
      status: data.status ?? 'unknown',
      notes: data.notes ?? null,
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
    })
  }

  async update(device: Device, data: UpdateDeviceInput & { updatedBy: string }) {
    device.merge(data)
    await device.save()
    return device
  }

  async softDelete(device: Device, deletedBy: string) {
    device.deletedAt = DateTime.now()
    device.deletedBy = deletedBy
    device.updatedBy = deletedBy
    await device.save()
  }

  async findDeviceType(id: string) {
    return DeviceType.find(id)
  }

  async loadPorts(device: Device) {
    await device.load('ports')
  }

  async loadDeviceType(device: Device) {
    await device.load('deviceType')
  }

  async createPort(data: {
    deviceId: string
    name: string
    portNumber: number
    portType: string
    speed?: string | null
    status: 'up' | 'down' | 'disabled'
    description?: string | null
    isPassthrough?: boolean
    chassisFace?: 'front' | 'rear'
  }) {
    return Port.create({
      deviceId: data.deviceId,
      name: data.name,
      portNumber: data.portNumber,
      portType: data.portType,
      speed: data.speed ?? null,
      status: data.status,
      description: data.description ?? null,
      isPassthrough: data.isPassthrough ?? false,
      chassisFace: data.chassisFace ?? 'front',
    })
  }
}
