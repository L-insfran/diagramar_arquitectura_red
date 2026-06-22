import vine from '@vinejs/vine'

const portType = vine.enum(['ethernet', 'fiber', 'serial', 'wireless', 'wan', 'sfp'] as const)
const portStatus = vine.enum(['up', 'down', 'disabled'] as const)

export const createPortValidator = vine.compile(
  vine.object({
    deviceId: vine.string().uuid(),
    name: vine.string().trim().minLength(1).maxLength(100),
    portNumber: vine.number().positive().withoutDecimals(),
    portType: portType.optional(),
    speed: vine.string().trim().maxLength(50).optional().nullable(),
    status: portStatus.optional(),
    description: vine.string().trim().optional(),
  })
)

export const updatePortValidator = vine.compile(
  vine.object({
    deviceId: vine.string().uuid().optional(),
    name: vine.string().trim().minLength(1).maxLength(100).optional(),
    portNumber: vine.number().positive().withoutDecimals().optional(),
    portType: portType.optional(),
    speed: vine.string().trim().maxLength(50).optional().nullable(),
    status: portStatus.optional(),
    description: vine.string().trim().optional(),
  })
)
