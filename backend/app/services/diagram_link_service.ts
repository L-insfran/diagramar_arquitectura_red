import { Exception } from '@adonisjs/core/exceptions'
import db from '@adonisjs/lucid/services/db'
import DiagramLinkRepository from '#repositories/diagram_link_repository'
import type {
  CreateDiagramLinkInput,
  DiagramLinkEdge,
  UpdateDiagramLinkInput,
} from '#dtos/diagram_link_dto'
import type Device from '#models/device'
import type DiagramLink from '#models/diagram_link'

function containerName(device: Device): string | null {
  // Board mount wins over rack (mutual exclusion; prefer explicit boardId)
  if (device.boardId && device.board) return device.board.name
  if (device.rackId && device.rack) return device.rack.name
  if (device.board) return device.board.name
  if (device.rack) return device.rack.name
  return null
}

/** e.g. "Rack 1 -> OS2 -LAN 1" — joined as "… A …" on the edge label */
export function formatDiagramLinkEndpoint(device: Device, portLabel: string): string {
  const container = containerName(device)
  const portPart = portLabel.startsWith('-') ? portLabel : `-${portLabel}`
  if (container) return `${container} -> ${device.name} ${portPart}`
  return `${device.name} ${portPart}`
}

export default class DiagramLinkService {
  private links = new DiagramLinkRepository()

  async getAllByProject(projectId: string) {
    return this.links.findAllByProject(projectId)
  }

  async softDeleteOrphansWithDeletedDevices(actorId: string) {
    await this.links.softDeleteOrphansWithDeletedDevices(actorId)
  }

  toApi(link: DiagramLink) {
    return {
      id: link.id,
      projectId: link.projectId,
      code: link.code,
      sourceDeviceId: link.sourceDeviceId,
      targetDeviceId: link.targetDeviceId,
      sourcePortId: link.sourcePortId,
      targetPortId: link.targetPortId,
      sourcePortLabel: link.sourcePortLabel,
      targetPortLabel: link.targetPortLabel,
      description: link.description,
      createdAt: link.createdAt?.toISO?.() ?? null,
      updatedAt: link.updatedAt?.toISO?.() ?? null,
    }
  }

  async getById(id: string) {
    return this.links.findByIdOrFail(id)
  }

  async getSummary(id: string) {
    return this.links.findSummaryOrFail(id)
  }

  private async assertDevicesAndPorts(
    projectId: string,
    sourceDeviceId: string,
    targetDeviceId: string,
    sourcePortId: string | null | undefined,
    targetPortId: string | null | undefined
  ) {
    if (sourceDeviceId === targetDeviceId) {
      throw new Exception('Origen y destino deben ser equipos distintos', { status: 422 })
    }

    const sourceDevice = await this.links.findActiveDeviceInProject(sourceDeviceId, projectId)
    if (!sourceDevice) {
      throw new Exception('El equipo origen no pertenece al proyecto o no existe', { status: 422 })
    }
    const targetDevice = await this.links.findActiveDeviceInProject(targetDeviceId, projectId)
    if (!targetDevice) {
      throw new Exception('El equipo destino no pertenece al proyecto o no existe', { status: 422 })
    }

    if (sourcePortId) {
      const port = await this.links.findPortOnDevice(sourcePortId, sourceDeviceId)
      if (!port) {
        throw new Exception('El puerto origen no pertenece al equipo indicado', { status: 422 })
      }
    }
    if (targetPortId) {
      const port = await this.links.findPortOnDevice(targetPortId, targetDeviceId)
      if (!port) {
        throw new Exception('El puerto destino no pertenece al equipo indicado', { status: 422 })
      }
    }

    return { sourceDevice, targetDevice }
  }

  /**
   * Un puerto (por id o etiqueta en el equipo) solo puede figurar en un
   * diagram_link activo del proyecto. Independiente de connections/topología.
   */
  private async assertDiagramPortAvailable(
    deviceId: string,
    portId: string | null | undefined,
    portLabel: string,
    excludeLinkId?: string
  ) {
    const label = portLabel.trim()
    const conflictMsg =
      'Ese puerto ya está usado en otro enlace del diagrama. Elegí un puerto libre.'

    if (portId) {
      const byId = await this.links.findActiveUsingPortId(portId, excludeLinkId)
      if (byId) {
        throw new Exception(conflictMsg, { status: 409 })
      }
      const port = await this.links.findPortOnDevice(portId, deviceId)
      if (port) {
        const byCanonicalName = await this.links.findActiveUsingDevicePortLabel(
          deviceId,
          port.name,
          excludeLinkId
        )
        if (byCanonicalName) {
          throw new Exception(conflictMsg, { status: 409 })
        }
      }
    }

    if (label) {
      const byLabel = await this.links.findActiveUsingDevicePortLabel(
        deviceId,
        label,
        excludeLinkId
      )
      if (byLabel) {
        throw new Exception(conflictMsg, { status: 409 })
      }

      if (!portId) {
        const namedPorts = await this.links.findPortsByNameOnDevice(deviceId, label)
        for (const port of namedPorts) {
          const byResolvedId = await this.links.findActiveUsingPortId(port.id, excludeLinkId)
          if (byResolvedId) {
            throw new Exception(conflictMsg, { status: 409 })
          }
        }
      }
    }
  }

  private async assertBothEndpointsAvailable(
    sourceDeviceId: string,
    targetDeviceId: string,
    sourcePortId: string | null | undefined,
    targetPortId: string | null | undefined,
    sourcePortLabel: string,
    targetPortLabel: string,
    excludeLinkId?: string
  ) {
    await this.assertDiagramPortAvailable(
      sourceDeviceId,
      sourcePortId,
      sourcePortLabel,
      excludeLinkId
    )
    await this.assertDiagramPortAvailable(
      targetDeviceId,
      targetPortId,
      targetPortLabel,
      excludeLinkId
    )
  }

  async create(data: CreateDiagramLinkInput, actorId: string) {
    await this.assertDevicesAndPorts(
      data.projectId,
      data.sourceDeviceId,
      data.targetDeviceId,
      data.sourcePortId,
      data.targetPortId
    )

    let sourcePortLabel = data.sourcePortLabel.trim()
    let targetPortLabel = data.targetPortLabel.trim()

    if (data.sourcePortId) {
      const port = await this.links.findPortOnDevice(data.sourcePortId, data.sourceDeviceId)
      if (port && (!sourcePortLabel || sourcePortLabel === port.name)) {
        sourcePortLabel = port.name
      }
    }
    if (data.targetPortId) {
      const port = await this.links.findPortOnDevice(data.targetPortId, data.targetDeviceId)
      if (port && (!targetPortLabel || targetPortLabel === port.name)) {
        targetPortLabel = port.name
      }
    }

    await this.softDeleteOrphansWithDeletedDevices(actorId)

    await this.assertBothEndpointsAvailable(
      data.sourceDeviceId,
      data.targetDeviceId,
      data.sourcePortId,
      data.targetPortId,
      sourcePortLabel,
      targetPortLabel
    )

    const persist = () =>
      db.transaction(async (trx) => {
        const code = await this.links.nextCodeForProject(data.projectId, trx)
        return this.links.create(
          {
            ...data,
            sourcePortLabel,
            targetPortLabel,
            createdBy: actorId,
            updatedBy: actorId,
            code,
          },
          trx
        )
      })

    let link
    try {
      link = await persist()
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        link = await persist()
      } else {
        throw error
      }
    }
    return this.links.findByIdOrFail(link.id)
  }

  async update(id: string, data: UpdateDiagramLinkInput, actorId: string) {
    const existing = await this.links.findByIdOrFail(id)
    const sourceDeviceId = data.sourceDeviceId ?? existing.sourceDeviceId
    const targetDeviceId = data.targetDeviceId ?? existing.targetDeviceId
    const sourcePortId =
      data.sourcePortId !== undefined ? data.sourcePortId : existing.sourcePortId
    const targetPortId =
      data.targetPortId !== undefined ? data.targetPortId : existing.targetPortId
    const sourcePortLabel = (
      data.sourcePortLabel !== undefined ? data.sourcePortLabel : existing.sourcePortLabel
    ).trim()
    const targetPortLabel = (
      data.targetPortLabel !== undefined ? data.targetPortLabel : existing.targetPortLabel
    ).trim()

    await this.assertDevicesAndPorts(
      existing.projectId,
      sourceDeviceId,
      targetDeviceId,
      sourcePortId,
      targetPortId
    )

    await this.softDeleteOrphansWithDeletedDevices(actorId)

    await this.assertBothEndpointsAvailable(
      sourceDeviceId,
      targetDeviceId,
      sourcePortId,
      targetPortId,
      sourcePortLabel,
      targetPortLabel,
      id
    )

    await this.links.update(existing, { ...data, updatedBy: actorId })
    return this.links.findByIdOrFail(id)
  }

  async delete(id: string, actorId: string) {
    const link = await this.links.findSummaryOrFail(id)
    await this.links.softDelete(link, actorId)
  }

  async softDeleteByDeviceId(deviceId: string, actorId: string) {
    await this.links.softDeleteByDeviceId(deviceId, actorId)
  }

  toEdge(link: DiagramLink): DiagramLinkEdge {
    const sourceDevice = link.sourceDevice
    const targetDevice = link.targetDevice
    return {
      id: link.id,
      code: link.code,
      source: link.sourceDeviceId,
      target: link.targetDeviceId,
      sourcePort: link.sourcePortLabel,
      targetPort: link.targetPortLabel,
      sourcePortId: link.sourcePortId,
      targetPortId: link.targetPortId,
      sourceLabel: formatDiagramLinkEndpoint(sourceDevice, link.sourcePortLabel),
      targetLabel: formatDiagramLinkEndpoint(targetDevice, link.targetPortLabel),
      description: link.description,
    }
  }

  async listEdgesByProject(projectId: string): Promise<DiagramLinkEdge[]> {
    const links = await this.links.findAllByProject(projectId)
    return links.map((link) => this.toEdge(link))
  }
}
