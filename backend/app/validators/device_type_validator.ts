import vine from '@vinejs/vine'

export const createDeviceTypeValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255),
    icon: vine.string().trim().maxLength(100).optional(),
    description: vine.string().trim().optional(),
  })
)

export const updateDeviceTypeValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    icon: vine.string().trim().maxLength(100).optional(),
    description: vine.string().trim().optional(),
  })
)
