import { Exception } from '@adonisjs/core/exceptions'
import Device from '#models/device'
import Site from '#models/site'
import Area from '#models/area'
import Rack from '#models/rack'
import Connection from '#models/connection'
import Network from '#models/network'
import Vlan from '#models/vlan'
import DeviceTemplate from '#models/device_template'
import Project from '#models/project'
import type { AttachableType } from '#dtos/documentation_dto'

/**
 * Ensures the polymorphic target exists, is not soft-deleted, and belongs to projectId.
 */
export async function assertAttachableInProject(
  projectId: string,
  attachableType: AttachableType,
  attachableId: string
): Promise<void> {
  switch (attachableType) {
    case 'project': {
      if (attachableId !== projectId) {
        throw new Exception('attachableId debe coincidir con el projectId', { status: 422 })
      }
      await Project.findOrFail(attachableId)
      return
    }
    case 'site': {
      const site = await Site.query()
        .where('id', attachableId)
        .whereNull('deleted_at')
        .firstOrFail()
      if (site.projectId !== projectId) {
        throw new Exception('El sitio no pertenece al proyecto', { status: 422 })
      }
      return
    }
    case 'area': {
      const area = await Area.query()
        .where('id', attachableId)
        .whereNull('deleted_at')
        .preload('site')
        .firstOrFail()
      if (area.site.projectId !== projectId) {
        throw new Exception('El área no pertenece al proyecto', { status: 422 })
      }
      return
    }
    case 'rack': {
      const rack = await Rack.query()
        .where('id', attachableId)
        .whereNull('deleted_at')
        .firstOrFail()
      if (rack.projectId !== projectId) {
        throw new Exception('El rack no pertenece al proyecto', { status: 422 })
      }
      return
    }
    case 'device': {
      const device = await Device.query()
        .where('id', attachableId)
        .whereNull('deleted_at')
        .firstOrFail()
      if (device.projectId !== projectId) {
        throw new Exception('El dispositivo no pertenece al proyecto', { status: 422 })
      }
      return
    }
    case 'connection': {
      const conn = await Connection.query()
        .where('id', attachableId)
        .whereNull('deleted_at')
        .firstOrFail()
      if (conn.projectId !== projectId) {
        throw new Exception('La conexión no pertenece al proyecto', { status: 422 })
      }
      return
    }
    case 'network': {
      const network = await Network.query().where('id', attachableId).firstOrFail()
      if (network.projectId !== projectId) {
        throw new Exception('La red no pertenece al proyecto', { status: 422 })
      }
      return
    }
    case 'vlan': {
      const vlan = await Vlan.query().where('id', attachableId).firstOrFail()
      if (vlan.projectId !== projectId) {
        throw new Exception('La VLAN no pertenece al proyecto', { status: 422 })
      }
      return
    }
    case 'device_template': {
      // Global catalog: template is not scoped to a project; attachment still has project_id.
      await DeviceTemplate.query()
        .where('id', attachableId)
        .whereNull('deleted_at')
        .firstOrFail()
      return
    }
    default: {
      const _exhaustive: never = attachableType
      throw new Exception(`Tipo no soportado: ${_exhaustive}`, { status: 422 })
    }
  }
}
