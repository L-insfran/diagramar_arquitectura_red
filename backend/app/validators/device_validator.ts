import vine from '@vinejs/vine'

const deviceStatus = vine.enum(['online', 'offline', 'maintenance', 'unknown'] as const)
const rackFace = vine.enum(['front', 'rear', 'both'] as const)
const shelfWidthSlots = vine.enum([1, 3] as const)

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
    siteId: vine.string().uuid().nullable().optional(),
    areaId: vine.string().uuid().nullable().optional(),
    rackId: vine.string().uuid().nullable().optional(),
    rackUnitStart: vine.number().min(1).max(60).nullable().optional(),
    rackFace: rackFace.nullable().optional(),
    supportedByAccessoryId: vine.string().uuid().nullable().optional(),
    shelfSlotStart: vine.number().min(0).max(2).nullable().optional(),
    shelfWidthSlots: shelfWidthSlots.nullable().optional(),
    shelfHeightU: vine.number().min(1).max(20).nullable().optional(),
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
    supportedByAccessoryId: vine.string().uuid().nullable().optional(),
    shelfSlotStart: vine.number().min(0).max(2).nullable().optional(),
    shelfWidthSlots: shelfWidthSlots.nullable().optional(),
    shelfHeightU: vine.number().min(1).max(20).nullable().optional(),
    status: deviceStatus.optional(),
    notes: vine.string().trim().optional(),
  })
)
