import vine from '@vinejs/vine'

export const createSiteValidator = vine.compile(
  vine.object({
    projectId: vine.string().uuid(),
    name: vine.string().trim().minLength(1).maxLength(255),
    address: vine.string().trim().maxLength(500).optional(),
    notes: vine.string().trim().optional(),
  })
)

export const updateSiteValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    address: vine.string().trim().maxLength(500).nullable().optional(),
    notes: vine.string().trim().nullable().optional(),
  })
)

export const createAreaValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255),
    notes: vine.string().trim().optional(),
  })
)

export const updateAreaValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    notes: vine.string().trim().nullable().optional(),
    siteId: vine.string().uuid().optional(),
  })
)
