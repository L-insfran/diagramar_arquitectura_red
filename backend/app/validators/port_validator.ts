import vine from '@vinejs/vine'

const portType = vine
  .string()
  .trim()
  .toLowerCase()
  .minLength(1)
  .maxLength(50)
  .regex(/^[a-z][a-z0-9_-]*$/)
const portStatus = vine.enum(['up', 'down', 'disabled'] as const)
const chassisFace = vine.enum(['front', 'rear'] as const)

const vlanAssignment = vine.object({
  vlanId: vine.string().uuid(),
  isTagged: vine.boolean().optional(),
})

export const createPortValidator = vine.compile(
  vine.object({
    deviceId: vine.string().uuid(),
    name: vine.string().trim().minLength(1).maxLength(100),
    portNumber: vine.number().positive().withoutDecimals(),
    portType: portType.optional(),
    speed: vine.string().trim().maxLength(50).optional().nullable(),
    status: portStatus.optional(),
    description: vine.string().trim().optional(),
    isPassthrough: vine.boolean().optional(),
    chassisFace: chassisFace.optional(),
    /** Associa VLANs del inventario al puerto (access/trunk vía isTagged). */
    vlanAssignments: vine.array(vlanAssignment).optional(),
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
    isPassthrough: vine.boolean().optional(),
    chassisFace: chassisFace.optional(),
    /** Si se envía (aunque sea []), reemplaza las VLANs del puerto. */
    vlanAssignments: vine.array(vlanAssignment).optional(),
  })
)

/** Bulk set all ports of a device to up or down (not disabled). */
export const bulkUpdatePortStatusValidator = vine.compile(
  vine.object({
    status: vine.enum(['up', 'down'] as const),
  })
)

/** Bulk set is_passthrough on every port of a device. */
export const bulkUpdatePortPassthroughValidator = vine.compile(
  vine.object({
    isPassthrough: vine.boolean(),
  })
)
