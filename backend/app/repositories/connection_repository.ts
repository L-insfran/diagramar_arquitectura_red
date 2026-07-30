import { DateTime } from 'luxon'
import Connection from '#models/connection'
import Port from '#models/port'
import TopologyCanvasLayout from '#models/topology_canvas_layout'
import type {
  CreateConnectionInput,
  UpdateConnectionInput,
  UpsertCanvasLayoutInput,
} from '#dtos/connection_dto'

const UNIFIED_LAYER = 'unified'

export default class ConnectionRepository {
  async findAllByProjectWithPorts(projectId: string) {
    return Connection.query()
      .where('project_id', projectId)
      .whereNull('deleted_at')
      .preload('sourcePort', (query) => {
        query
          .preload('device', (dq) => dq.preload('deviceType'))
          .preload('vlans', (q) => q.preload('networks'))
      })
      .preload('targetPort', (query) => {
        query
          .preload('device', (dq) => dq.preload('deviceType'))
          .preload('vlans', (q) => q.preload('networks'))
      })
      .preload('cableType')
  }

  async findActiveSummaryOrFail(id: string) {
    return Connection.query().where('id', id).whereNull('deleted_at').firstOrFail()
  }

  async findByIdOrFail(id: string) {
    return Connection.query().where('id', id).whereNull('deleted_at').firstOrFail()
  }

  /** Active physical connection that occupies a port (as source or target). */
  async findActivePhysicalByPortId(portId: string, excludeConnectionId?: string) {
    const query = Connection.query()
      .whereNull('deleted_at')
      .where('connection_type', 'physical')
      .where((q) => {
        q.where('source_port_id', portId).orWhere('target_port_id', portId)
      })
    if (excludeConnectionId) {
      query.whereNot('id', excludeConnectionId)
    }
    return query.first()
  }

  async create(data: CreateConnectionInput & { createdBy: string; updatedBy: string }) {
    return Connection.create({
      projectId: data.projectId,
      sourcePortId: data.sourcePortId,
      targetPortId: data.targetPortId,
      connectionType: data.connectionType ?? 'physical',
      mediumType: data.mediumType ?? 'utp',
      cableTypeId: data.cableTypeId ?? null,
      cableCategory: data.cableCategory ?? null,
      fiberType: data.fiberType ?? null,
      fiberConnector: data.fiberConnector ?? null,
      wifiSsid: data.wifiSsid ?? null,
      wifiStandard: data.wifiStandard ?? null,
      wifiBand: data.wifiBand ?? null,
      wifiSecurity: data.wifiSecurity ?? null,
      cableLength: data.cableLength ?? null,
      connectionStatus: data.connectionStatus ?? 'implemented',
      bandwidth: data.bandwidth ?? null,
      description: data.description ?? null,
      metadata: data.metadata ?? null,
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
    })
  }

  async update(
    connection: Connection,
    data: UpdateConnectionInput & { updatedBy: string }
  ) {
    connection.merge(data)
    await connection.save()
    return connection
  }

  async softDelete(connection: Connection, deletedBy: string) {
    connection.deletedAt = DateTime.now()
    connection.deletedBy = deletedBy
    connection.updatedBy = deletedBy
    await connection.save()
  }

  async findPortWithDeviceOrFail(portId: string) {
    return Port.query().where('id', portId).preload('device').firstOrFail()
  }

  async findCanvasLayout(projectId: string, scope: string) {
    return TopologyCanvasLayout.query()
      .where('projectId', projectId)
      .where('layer', UNIFIED_LAYER)
      .where('scope', scope)
      .first()
  }

  async createCanvasLayout(
    scope: string,
    data: UpsertCanvasLayoutInput & {
      workAreas: UpsertCanvasLayoutInput['workAreas']
      nodeParents: Record<string, string>
    }
  ) {
    return TopologyCanvasLayout.create({
      projectId: data.projectId,
      layer: UNIFIED_LAYER,
      scope,
      nodePositions: data.nodePositions,
      labelOffsets: data.labelOffsets,
      workAreas: data.workAreas ?? [],
      nodeParents: data.nodeParents,
    })
  }

  async saveCanvasLayout(row: TopologyCanvasLayout) {
    await row.save()
    return row
  }

  async deleteCanvasLayout(row: TopologyCanvasLayout) {
    await row.delete()
  }
}
