import vine from '@vinejs/vine'

export const updateSystemBrandingValidator = vine.compile(
  vine.object({
    reportTagline: vine.string().trim().maxLength(255).nullable().optional(),
  })
)
