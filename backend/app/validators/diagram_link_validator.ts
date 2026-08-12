import vine from '@vinejs/vine'

export const createDiagramLinkValidator = vine.compile(
  vine.object({
    projectId: vine.string().uuid(),
    sourceDeviceId: vine.string().uuid(),
    targetDeviceId: vine.string().uuid(),
    sourcePortId: vine.string().uuid().nullable().optional(),
    targetPortId: vine.string().uuid().nullable().optional(),
    sourcePortLabel: vine.string().trim().minLength(1).maxLength(255),
    targetPortLabel: vine.string().trim().minLength(1).maxLength(255),
    description: vine.string().trim().nullable().optional(),
  })
)

export const updateDiagramLinkValidator = vine.compile(
  vine.object({
    sourceDeviceId: vine.string().uuid().optional(),
    targetDeviceId: vine.string().uuid().optional(),
    sourcePortId: vine.string().uuid().nullable().optional(),
    targetPortId: vine.string().uuid().nullable().optional(),
    sourcePortLabel: vine.string().trim().minLength(1).maxLength(255).optional(),
    targetPortLabel: vine.string().trim().minLength(1).maxLength(255).optional(),
    description: vine.string().trim().nullable().optional(),
  })
)
