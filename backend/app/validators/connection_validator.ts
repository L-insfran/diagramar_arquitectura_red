import vine from '@vinejs/vine'

const connectionType = vine.enum(['physical', 'logical'] as const)
const mediumType = vine.enum(['utp', 'fiber', 'wifi', 'internet'] as const)
const cableCategory = vine.enum(['5e', '6', '6a', '7', '7a', '8'] as const)
const fiberType = vine.enum(['singlemode', 'multimode'] as const)
const fiberConnector = vine.enum(['LC', 'SC', 'ST', 'FC', 'MPO', 'MTRJ'] as const)
const wifiStandard = vine.enum(['802.11n', '802.11ac', '802.11ax', '802.11be'] as const)
const wifiBand = vine.enum(['2.4GHz', '5GHz', '6GHz'] as const)
const wifiSecurity = vine.enum(['WPA2', 'WPA3', 'WPA2/WPA3', 'Open'] as const)
const connectionStatus = vine.enum(['planned', 'implemented', 'verified'] as const)
const logicalStatus = vine.enum(['active', 'down'] as const)
const portFace = vine.enum(['front', 'rear'] as const)

const metadataSchema = vine
  .object({
    vlanId: vine.number().min(1).optional(),
    vlanName: vine.string().trim().maxLength(100).optional(),
    networkName: vine.string().trim().maxLength(100).optional(),
    notes: vine.string().trim().maxLength(500).optional(),
    status: logicalStatus.optional(),
  })
  .optional()

export const createConnectionValidator = vine.compile(
  vine.object({
    projectId: vine.string().uuid(),
    sourcePortId: vine.string().uuid(),
    targetPortId: vine.string().uuid(),
    /** Passthrough (patch panel): 1 conexión física activa por (puerto, cara). */
    sourceFace: portFace.optional(),
    targetFace: portFace.optional(),
    // Kept optional for backwards compatibility; new UI always creates physical links
    connectionType: connectionType.optional(),
    mediumType: mediumType.optional(),
    cableTypeId: vine.string().uuid().optional().nullable(),
    cableCategory: cableCategory.optional().nullable(),
    fiberType: fiberType.optional().nullable(),
    fiberConnector: fiberConnector.optional().nullable(),
    wifiSsid: vine.string().trim().maxLength(100).optional().nullable(),
    wifiStandard: wifiStandard.optional().nullable(),
    wifiBand: wifiBand.optional().nullable(),
    wifiSecurity: wifiSecurity.optional().nullable(),
    cableLength: vine.string().trim().maxLength(20).optional().nullable(),
    connectionStatus: connectionStatus.optional(),
    bandwidth: vine.string().trim().maxLength(100).optional(),
    description: vine.string().trim().optional(),
    metadata: metadataSchema,
  })
)

export const updateConnectionValidator = vine.compile(
  vine.object({
    sourcePortId: vine.string().uuid().optional(),
    targetPortId: vine.string().uuid().optional(),
    sourceFace: portFace.optional(),
    targetFace: portFace.optional(),
    connectionType: connectionType.optional(),
    mediumType: mediumType.optional(),
    cableTypeId: vine.string().uuid().optional().nullable(),
    cableCategory: cableCategory.optional().nullable(),
    fiberType: fiberType.optional().nullable(),
    fiberConnector: fiberConnector.optional().nullable(),
    wifiSsid: vine.string().trim().maxLength(100).optional().nullable(),
    wifiStandard: wifiStandard.optional().nullable(),
    wifiBand: wifiBand.optional().nullable(),
    wifiSecurity: wifiSecurity.optional().nullable(),
    cableLength: vine.string().trim().maxLength(20).optional().nullable(),
    connectionStatus: connectionStatus.optional(),
    bandwidth: vine.string().trim().maxLength(100).optional().nullable(),
    description: vine.string().trim().optional().nullable(),
    metadata: metadataSchema,
  })
)
