import vine from '@vinejs/vine'

export const createProjectValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255),
    clientName: vine.string().trim().maxLength(255).optional(),
    address: vine.string().trim().maxLength(500).optional(),
  })
)

export const updateProjectValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    clientName: vine.string().trim().maxLength(255).optional(),
    address: vine.string().trim().maxLength(500).optional(),
  })
)
