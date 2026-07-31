import vine from '@vinejs/vine'

export const createDeviceTemplateValidator = vine.compile(
  vine.object({
    deviceTypeId: vine.string().uuid(),
    name: vine.string().trim().minLength(1).maxLength(255),
    manufacturer: vine.string().trim().maxLength(255).nullable().optional(),
    model: vine.string().trim().maxLength(255).nullable().optional(),
    rackUnits: vine.number().min(1).max(100).nullable().optional(),
    imageUrl: vine.string().trim().maxLength(500).nullable().optional(),
    frontViewUrl: vine.string().trim().maxLength(500).nullable().optional(),
    rearViewUrl: vine.string().trim().maxLength(500).nullable().optional(),
    powerConsumptionW: vine.number().min(0).nullable().optional(),
    weightKg: vine.number().min(0).nullable().optional(),
    notes: vine.string().trim().nullable().optional(),
  })
)

export const updateDeviceTemplateValidator = vine.compile(
  vine.object({
    deviceTypeId: vine.string().uuid().optional(),
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    manufacturer: vine.string().trim().maxLength(255).optional(),
    model: vine.string().trim().maxLength(255).optional(),
    rackUnits: vine.number().min(1).max(100).nullable().optional(),
    imageUrl: vine.string().trim().maxLength(500).nullable().optional(),
    frontViewUrl: vine.string().trim().maxLength(500).nullable().optional(),
    rearViewUrl: vine.string().trim().maxLength(500).nullable().optional(),
    powerConsumptionW: vine.number().min(0).nullable().optional(),
    weightKg: vine.number().min(0).nullable().optional(),
    notes: vine.string().trim().nullable().optional(),
  })
)

export const createDeviceTemplatePortValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(100),
    portNumber: vine.number().min(1).max(9999),
    portType: vine.string().trim().minLength(1).maxLength(50),
    speed: vine.string().trim().maxLength(50).nullable().optional(),
    description: vine.string().trim().nullable().optional(),
    isPassthrough: vine.boolean().optional(),
  })
)

export const updateDeviceTemplatePortValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(100).optional(),
    portNumber: vine.number().min(1).max(9999).optional(),
    portType: vine.string().trim().minLength(1).maxLength(50).optional(),
    speed: vine.string().trim().maxLength(50).nullable().optional(),
    description: vine.string().trim().nullable().optional(),
    isPassthrough: vine.boolean().optional(),
  })
)

/** Bulk set is_passthrough on every port of a device template. */
export const bulkUpdateTemplatePortPassthroughValidator = vine.compile(
  vine.object({
    isPassthrough: vine.boolean(),
  })
)
