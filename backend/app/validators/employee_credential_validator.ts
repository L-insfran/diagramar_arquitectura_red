import vine from '@vinejs/vine'

const credentialKind = vine.enum(['file_server', 'vpn', 'email', 'rdp', 'other'] as const)

export const createEmployeeCredentialValidator = vine.compile(
  vine.object({
    employeeId: vine.string().uuid(),
    projectId: vine.string().uuid(),
    kind: credentialKind.optional(),
    label: vine.string().trim().maxLength(255).optional(),
    username: vine.string().trim().minLength(1).maxLength(255),
    password: vine.string().minLength(1).maxLength(500),
    notes: vine.string().trim().maxLength(1000).optional(),
  })
)

export const updateEmployeeCredentialValidator = vine.compile(
  vine.object({
    kind: credentialKind.optional(),
    label: vine.string().trim().maxLength(255).optional().nullable(),
    username: vine.string().trim().minLength(1).maxLength(255).optional(),
    password: vine.string().minLength(1).maxLength(500).optional(),
    notes: vine.string().trim().maxLength(1000).optional().nullable(),
  })
)
