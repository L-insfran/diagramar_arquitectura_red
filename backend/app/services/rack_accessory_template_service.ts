import { Exception } from '@adonisjs/core/exceptions'
import RackAccessoryTemplateRepository from '#repositories/rack_accessory_template_repository'
import type {
  AccessoryKind,
  CreateRackAccessoryTemplateInput,
  RackFace,
  UpdateRackAccessoryTemplateInput,
} from '#dtos/rack_accessory_dto'
import {
  CHASSIS_HEIGHT_U_DEFAULT,
  DEVICE_SLOT_COUNT_DEFAULT,
  HANG_HEIGHT_U_DEFAULT,
  accessoryUsesFace,
  maxHeightForAccessoryKind,
  resolveDeviceSlotCount,
} from '#dtos/rack_accessory_dto'

function normalizeFaceForKind(
  kind: AccessoryKind,
  face: RackFace | null | undefined
): RackFace | null {
  if (accessoryUsesFace(kind)) {
    return face === 'rear' ? 'rear' : 'front'
  }
  if (face != null) {
    throw new Exception('Las bandejas no usan el campo face', { status: 422 })
  }
  return null
}

function assertHeightForKind(kind: AccessoryKind, heightU: number) {
  const max = maxHeightForAccessoryKind(kind)
  if (heightU < 1 || heightU > max) {
    const label =
      kind === 'hang'
        ? 'accesorio colgante'
        : kind === 'chassis'
          ? 'ordenador / chasis'
          : 'bandeja'
    throw new Exception(`La altura del ${label} debe ser entre 1 y ${max}U`, { status: 422 })
  }
}

export default class RackAccessoryTemplateService {
  private templates = new RackAccessoryTemplateRepository()

  async getAll() {
    return this.templates.findAll()
  }

  async getById(id: string) {
    return this.templates.findByIdOrFail(id)
  }

  async create(data: CreateRackAccessoryTemplateInput, actorId: string) {
    const kind: AccessoryKind = data.kind ?? 'shelf'
    let horizontalSlotStart = data.horizontalSlotStart ?? 0
    let horizontalWidthSlots = data.horizontalWidthSlots ?? 6

    if (kind === 'chassis') {
      horizontalSlotStart = 0
      horizontalWidthSlots = 6
    }

    if (horizontalSlotStart + horizontalWidthSlots > 6) {
      throw new Exception(
        `La huella horizontal (inicio ${horizontalSlotStart + 1}, ancho ${horizontalWidthSlots}) no cabe en 6 columnas`,
        { status: 422 }
      )
    }

    let heightU = data.heightU
    if (kind === 'hang' && (heightU == null || heightU === undefined)) {
      heightU = HANG_HEIGHT_U_DEFAULT
    }
    if (kind === 'chassis' && (heightU == null || heightU === undefined)) {
      heightU = CHASSIS_HEIGHT_U_DEFAULT
    }
    assertHeightForKind(kind, heightU)
    const face = normalizeFaceForKind(kind, data.face)

    const row = await this.templates.create({
      ...data,
      kind,
      heightU,
      face,
      defaultMountType: data.defaultMountType ?? 'front_only',
      deviceSlotCount: resolveDeviceSlotCount(kind, data.deviceSlotCount ?? DEVICE_SLOT_COUNT_DEFAULT),
      horizontalSlotStart,
      horizontalWidthSlots,
      createdBy: actorId,
      updatedBy: actorId,
    })
    return this.templates.findByIdOrFail(row.id)
  }

  async update(id: string, data: UpdateRackAccessoryTemplateInput, actorId: string) {
    const row = await this.templates.findByIdOrFail(id)
    const kind = row.kind as AccessoryKind
    let horizontalSlotStart = data.horizontalSlotStart ?? row.horizontalSlotStart
    let horizontalWidthSlots = data.horizontalWidthSlots ?? row.horizontalWidthSlots

    if (kind === 'chassis') {
      horizontalSlotStart = 0
      horizontalWidthSlots = 6
    }

    if (horizontalSlotStart + horizontalWidthSlots > 6) {
      throw new Exception(
        `La huella horizontal (inicio ${horizontalSlotStart + 1}, ancho ${horizontalWidthSlots}) no cabe en 6 columnas`,
        { status: 422 }
      )
    }

    const heightU = data.heightU ?? row.heightU
    assertHeightForKind(kind, heightU)

    let face: RackFace | null = row.face
    if (accessoryUsesFace(kind)) {
      if (data.face !== undefined) {
        face = data.face === 'rear' ? 'rear' : 'front'
      }
    } else {
      face = null
    }

    await this.templates.update(row, {
      ...data,
      face,
      deviceSlotCount: resolveDeviceSlotCount(
        kind,
        data.deviceSlotCount !== undefined ? data.deviceSlotCount : row.deviceSlotCount
      ),
      ...(data.horizontalSlotStart !== undefined ||
      data.horizontalWidthSlots !== undefined ||
      kind === 'chassis'
        ? { horizontalSlotStart, horizontalWidthSlots }
        : {}),
      updatedBy: actorId,
    })
    return this.templates.findByIdOrFail(id)
  }

  async delete(id: string, actorId: string) {
    const row = await this.templates.findByIdOrFail(id)
    await this.templates.softDelete(row, actorId)
  }
}
