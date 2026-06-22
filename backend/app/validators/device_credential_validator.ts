import vine from '@vinejs/vine'

const credentialType = vine.enum(['ssh', 'telnet', 'snmp', 'web', 'api'] as const)

export const createDeviceCredentialValidator = vine.compile(
  vine.object({
    deviceId: vine.string().uuid(),
    credentialType: credentialType.optional(),
    username: vine.string().trim().maxLength(255).optional(),
    password: vine.string().minLength(1).maxLength(255),
    port: vine.number().positive().withoutDecimals().optional(),
    communityString: vine.string().trim().maxLength(255).optional(),
    notes: vine.string().trim().optional(),
  })
)

export const updateDeviceCredentialValidator = vine.compile(
  vine.object({
    credentialType: credentialType.optional(),
    username: vine.string().trim().maxLength(255).optional(),
    password: vine.string().minLength(1).maxLength(255).optional(),
    port: vine.number().positive().withoutDecimals().optional(),
    communityString: vine.string().trim().maxLength(255).optional(),
    notes: vine.string().trim().optional(),
  })
)
