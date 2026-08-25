import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import db from '@adonisjs/lucid/services/db'
import DiagramLink from '#models/diagram_link'
import Device from '#models/device'
import Port from '#models/port'
import type { CreateDiagramLinkInput, UpdateDiagramLinkInput } from '#dtos/diagram_link_dto'

/** Ignore links whose source or target device was soft-deleted. */
function whereBothEndpointsActive(q: ModelQueryBuilderContract<typeof DiagramLink>) {
  return q
    .whereRaw(
      `EXISTS (
        SELECT 1 FROM devices
        WHERE devices.id = diagram_links.source_device_id AND devices.deleted_at IS NULL
      )`
    )
    .whereRaw(
      `EXISTS (
        SELECT 1 FROM devices
        WHERE devices.id = diagram_links.target_device_id AND devices.deleted_at IS NULL
      )`
    )
}

/** Active diagram_links whose source or target device is missing / soft-deleted. */
function whereOrphanEndpoints(q: ModelQueryBuilderContract<typeof DiagramLink>) {
  return q.where((builder) => {
    builder
      .whereRaw(
        `NOT EXISTS (
          SELECT 1 FROM devices
          WHERE devices.id = diagram_links.source_device_id AND devices.deleted_at IS NULL
        )`
      )
      .orWhereRaw(
        `NOT EXISTS (
          SELECT 1 FROM devices
          WHERE devices.id = diagram_links.target_device_id AND devices.deleted_at IS NULL
        )`
      )
  })
}

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
    return whereBothEndpointsActive(
      DiagramLink.query().where('project_id', projectId).whereNull('deleted_at')
    )
      .preload('sourceDevice', (q) => q.preload('container'))
      .preload('targetDevice', (q) => q.preload('container'))
      .preload('sourcePort')
      .preload('targetPort')
      .preload('cableType')
      .orderBy('code', 'asc')
      .orderBy('created_at', 'asc')
  }

  async findByIdOrFail(id: string) {
    return DiagramLink.query()
      .where('id', id)
      .whereNull('deleted_at')
      .preload('sourceDevice', (q) => q.preload('container'))
      .preload('targetDevice', (q) => q.preload('container'))
      .preload('sourcePort')
      .preload('targetPort')
      .preload('cableType')
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
        cableTypeId: data.cableTypeId ?? null,
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

  async softDeleteByDeviceId(deviceId: string, deletedBy: string) {
    const now = DateTime.now().toISO()
    await db
      .from('diagram_links')
      .whereNull('deleted_at')
      .where((builder) => {
        builder.where('source_device_id', deviceId).orWhere('target_device_id', deviceId)
      })
      .update({
        deleted_at: now,
        deleted_by: deletedBy,
        updated_by: deletedBy,
        updated_at: now,
      })
  }

  async findActiveByDevice(projectId: string, deviceId: string) {
    return whereBothEndpointsActive(
      DiagramLink.query()
        .where('project_id', projectId)
        .whereNull('deleted_at')
        .where((builder) => {
          builder
            .where('source_device_id', deviceId)
            .orWhere('target_device_id', deviceId)
        }),
    ).select('id', 'code')
  }

  async softDeleteByDeviceIds(
    projectId: string,
    deviceIds: string[],
    deletedBy: string,
  ): Promise<{ deletedCount: number; codes: number[] }> {
    if (deviceIds.length === 0) return { deletedCount: 0, codes: [] }
    const rows = await DiagramLink.query()
      .where('project_id', projectId)
      .whereNull('deleted_at')
      .where((builder) => {
        builder.whereIn('source_device_id', deviceIds).orWhereIn('target_device_id', deviceIds)
      })
      .select('id', 'code')
    if (rows.length === 0) return { deletedCount: 0, codes: [] }
    const now = DateTime.now().toISO()
    await db
      .from('diagram_links')
      .whereIn(
        'id',
        rows.map((r) => r.id),
      )
      .update({
        deleted_at: now,
        deleted_by: deletedBy,
        updated_by: deletedBy,
        updated_at: now,
      })
    return {
      deletedCount: rows.length,
      codes: rows.map((r) => r.code).filter((c) => c != null),
    }
  }

  async findOrphansWithDeletedDevices() {
    return whereOrphanEndpoints(DiagramLink.query().whereNull('deleted_at'))
  }

  /** Soft-delete all active links with a missing/soft-deleted endpoint. */
  async softDeleteOrphansWithDeletedDevices(deletedBy: string) {
    const now = DateTime.now().toISO()
    await db
      .from('diagram_links')
      .whereNull('deleted_at')
      .where((builder) => {
        builder
          .whereRaw(
            `NOT EXISTS (
              SELECT 1 FROM devices
              WHERE devices.id = diagram_links.source_device_id AND devices.deleted_at IS NULL
            )`
          )
          .orWhereRaw(
            `NOT EXISTS (
              SELECT 1 FROM devices
              WHERE devices.id = diagram_links.target_device_id AND devices.deleted_at IS NULL
            )`
          )
      })
      .update({
        deleted_at: now,
        deleted_by: deletedBy,
        updated_by: deletedBy,
        updated_at: now,
      })
  }

  async findActiveDeviceInProject(deviceId: string, projectId: string) {
    return Device.query()
      .where('id', deviceId)
      .where('project_id', projectId)
      .whereNull('deleted_at')
      .preload('container')
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
    const q = whereBothEndpointsActive(
      DiagramLink.query()
        .whereNull('deleted_at')
        .where((builder) => {
          builder.where('source_port_id', portId).orWhere('target_port_id', portId)
        })
    )
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

    const q = whereBothEndpointsActive(
      DiagramLink.query()
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
    )
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
