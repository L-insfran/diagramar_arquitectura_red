import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import DiagramLink from '#models/diagram_link'
import Device from '#models/device'
import Port from '#models/port'
import type { CreateDiagramLinkInput, UpdateDiagramLinkInput } from '#dtos/diagram_link_dto'

type CountRow = { max_code: string | number | null }

export default class DiagramLinkRepository {
  /**
   * Next correlative code for the project. Includes soft-deleted rows so
   * numbers are never recycled.
   */
  async nextCodeForProject(projectId: string, trx: TransactionClientContract) {
    const row = (await trx
      .from('diagram_links')
      .where('project_id', projectId)
      .max('code as max_code')
      .first()) as CountRow | null
    return Number(row?.max_code ?? 0) + 1
  }

  async findAllByProject(projectId: string) {
    return DiagramLink.query()
      .where('project_id', projectId)
      .whereNull('deleted_at')
      .preload('sourceDevice', (q) => q.preload('rack').preload('board'))
      .preload('targetDevice', (q) => q.preload('rack').preload('board'))
      .preload('sourcePort')
      .preload('targetPort')
      .orderBy('code', 'asc')
      .orderBy('created_at', 'asc')
  }

  async findByIdOrFail(id: string) {
    return DiagramLink.query()
      .where('id', id)
      .whereNull('deleted_at')
      .preload('sourceDevice', (q) => q.preload('rack').preload('board'))
      .preload('targetDevice', (q) => q.preload('rack').preload('board'))
      .preload('sourcePort')
      .preload('targetPort')
      .firstOrFail()
  }

  async findSummaryOrFail(id: string) {
    return DiagramLink.query().where('id', id).whereNull('deleted_at').firstOrFail()
  }

  async create(
    data: CreateDiagramLinkInput & { createdBy: string; updatedBy: string; code: number },
    trx?: TransactionClientContract
  ) {
    return DiagramLink.create(
      {
        projectId: data.projectId,
        code: data.code,
        sourceDeviceId: data.sourceDeviceId,
        targetDeviceId: data.targetDeviceId,
        sourcePortId: data.sourcePortId ?? null,
        targetPortId: data.targetPortId ?? null,
        sourcePortLabel: data.sourcePortLabel,
        targetPortLabel: data.targetPortLabel,
        description: data.description ?? null,
        createdBy: data.createdBy,
        updatedBy: data.updatedBy,
      },
      trx ? { client: trx } : undefined
    )
  }

  async update(link: DiagramLink, data: UpdateDiagramLinkInput & { updatedBy: string }) {
    link.merge(data)
    await link.save()
    return link
  }

  async softDelete(link: DiagramLink, deletedBy: string) {
    link.deletedAt = DateTime.now()
    link.deletedBy = deletedBy
    link.updatedBy = deletedBy
    await link.save()
  }

  async findActiveDeviceInProject(deviceId: string, projectId: string) {
    return Device.query()
      .where('id', deviceId)
      .where('project_id', projectId)
      .whereNull('deleted_at')
      .preload('rack')
      .preload('board')
      .first()
  }

  async findPortOnDevice(portId: string, deviceId: string) {
    return Port.query()
      .where('id', portId)
      .where('device_id', deviceId)
      .first()
  }

  /** Active diagram_link that already uses this port as source or target. */
  async findActiveUsingPortId(portId: string, excludeLinkId?: string) {
    const q = DiagramLink.query()
      .whereNull('deleted_at')
      .where((builder) => {
        builder.where('source_port_id', portId).orWhere('target_port_id', portId)
      })
    if (excludeLinkId) q.whereNot('id', excludeLinkId)
    return q.first()
  }

  /**
   * Active diagram_link where the same device already exposes this port label
   * (source or target), case-insensitive trimmed match.
   */
  async findActiveUsingDevicePortLabel(
    deviceId: string,
    portLabel: string,
    excludeLinkId?: string
  ) {
    const normalized = portLabel.trim().toLowerCase()
    if (!normalized) return null

    const q = DiagramLink.query()
      .whereNull('deleted_at')
      .where((builder) => {
        builder
          .where((src) => {
            src
              .where('source_device_id', deviceId)
              .whereRaw('LOWER(TRIM(source_port_label)) = ?', [normalized])
          })
          .orWhere((tgt) => {
            tgt
              .where('target_device_id', deviceId)
              .whereRaw('LOWER(TRIM(target_port_label)) = ?', [normalized])
          })
      })
    if (excludeLinkId) q.whereNot('id', excludeLinkId)
    return q.first()
  }

  async findPortsByNameOnDevice(deviceId: string, portLabel: string) {
    const normalized = portLabel.trim().toLowerCase()
    if (!normalized) return []
    return Port.query()
      .where('device_id', deviceId)
      .whereRaw('LOWER(TRIM(name)) = ?', [normalized])
  }
}
