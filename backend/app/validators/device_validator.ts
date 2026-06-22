import vine from '@vinejs/vine'

const deviceStatus = vine.enum(['online', 'offline', 'maintenance', 'unknown'] as const)

export const createDeviceValidator = vine.compile(
  vine.object({
    companyId: vine.string().uuid(),
    deviceTypeId: vine.string().uuid(),
    name: vine.string().trim().minLength(1).maxLength(255),
    hostname: vine.string().trim().maxLength(255).optional(),
    ipAddress: vine.string().trim().maxLength(45).optional(),
    macAddress: vine.string().trim().maxLength(17).optional(),
    model: vine.string().trim().maxLength(255).optional(),
    manufacturer: vine.string().trim().maxLength(255).optional(),
    serialNumber: vine.string().trim().maxLength(255).optional(),
    firmwareVersion: vine.string().trim().maxLength(100).optional(),
    location: vine.string().trim().maxLength(255).optional(),
    status: deviceStatus.optional(),
    notes: vine.string().trim().optional(),
  })
)

export const updateDeviceValidator = vine.compile(
  vine.object({
    companyId: vine.string().uuid().optional(),
    deviceTypeId: vine.string().uuid().optional(),
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    hostname: vine.string().trim().maxLength(255).optional(),
    ipAddress: vine.string().trim().maxLength(45).optional(),
    macAddress: vine.string().trim().maxLength(17).optional(),
    model: vine.string().trim().maxLength(255).optional(),
    manufacturer: vine.string().trim().maxLength(255).optional(),
    serialNumber: vine.string().trim().maxLength(255).optional(),
    firmwareVersion: vine.string().trim().maxLength(100).optional(),
    location: vine.string().trim().maxLength(255).optional(),
    status: deviceStatus.optional(),
    notes: vine.string().trim().optional(),
  })
)
