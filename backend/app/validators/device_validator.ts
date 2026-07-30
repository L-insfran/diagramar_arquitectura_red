import vine from '@vinejs/vine'

const deviceStatus = vine.enum(['online', 'offline', 'maintenance', 'unknown'] as const)
const rackFace = vine.enum(['front', 'rear'] as const)

export const createDeviceValidator = vine.compile(
  vine.object({
    projectId: vine.string().uuid(),
    deviceTemplateId: vine.string().uuid(),
    name: vine.string().trim().minLength(1).maxLength(255),
    hostname: vine.string().trim().maxLength(255).optional(),
    ipAddress: vine.string().trim().maxLength(45).optional(),
    macAddress: vine.string().trim().maxLength(17).optional(),
    serialNumber: vine.string().trim().maxLength(255).optional(),
    firmwareVersion: vine.string().trim().maxLength(100).optional(),
    location: vine.string().trim().maxLength(255).optional(),
    siteId: vine.string().uuid().optional(),
    areaId: vine.string().uuid().optional(),
    rackId: vine.string().uuid().optional(),
    rackUnitStart: vine.number().min(1).max(60).optional(),
    rackFace: rackFace.optional(),
    status: deviceStatus.optional(),
    notes: vine.string().trim().optional(),
  })
)

export const updateDeviceValidator = vine.compile(
  vine.object({
    projectId: vine.string().uuid().optional(),
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    hostname: vine.string().trim().maxLength(255).optional(),
    ipAddress: vine.string().trim().maxLength(45).optional(),
    macAddress: vine.string().trim().maxLength(17).optional(),
    serialNumber: vine.string().trim().maxLength(255).optional(),
    firmwareVersion: vine.string().trim().maxLength(100).optional(),
    location: vine.string().trim().maxLength(255).optional(),
    siteId: vine.string().uuid().nullable().optional(),
    areaId: vine.string().uuid().nullable().optional(),
    rackId: vine.string().uuid().nullable().optional(),
    rackUnitStart: vine.number().min(1).max(60).nullable().optional(),
    rackFace: rackFace.nullable().optional(),
    status: deviceStatus.optional(),
    notes: vine.string().trim().optional(),
  })
)
