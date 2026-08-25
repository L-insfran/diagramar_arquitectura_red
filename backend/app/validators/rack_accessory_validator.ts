import vine from '@vinejs/vine'

const shelfHeightU = vine.number().withoutDecimals().min(1).max(6)
const hangHeightU = vine.number().withoutDecimals().min(1).max(5)
const chassisHeightU = vine.number().withoutDecimals().min(1).max(4)
const heightU = vine.number().withoutDecimals().min(1).max(6)
const mountType = vine.enum(['front_only', 'four_post'] as const)
const kind = vine.enum(['shelf', 'hang', 'chassis'] as const)
const face = vine.enum(['front', 'rear'] as const)
const deviceSlotCount = vine.number().withoutDecimals().min(0).max(5)
const horizontalSlotStart = vine.number().withoutDecimals().min(0).max(4)
const horizontalWidthSlots = vine.number().withoutDecimals().min(2).max(6)

export const createRackAccessoryTemplateValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255),
    kind: kind.optional(),
    heightU,
    defaultMountType: mountType.optional(),
    deviceSlotCount: deviceSlotCount.optional(),
    face: face.nullable().optional(),
    horizontalSlotStart: horizontalSlotStart.optional(),
    horizontalWidthSlots: horizontalWidthSlots.optional(),
    manufacturer: vine.string().trim().maxLength(255).optional(),
    model: vine.string().trim().maxLength(255).optional(),
    notes: vine.string().trim().optional(),
  })
)

export const updateRackAccessoryTemplateValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    heightU: heightU.optional(),
    defaultMountType: mountType.optional(),
    deviceSlotCount: deviceSlotCount.optional(),
    face: face.nullable().optional(),
    horizontalSlotStart: horizontalSlotStart.optional(),
    horizontalWidthSlots: horizontalWidthSlots.optional(),
    manufacturer: vine.string().trim().maxLength(255).nullable().optional(),
    model: vine.string().trim().maxLength(255).nullable().optional(),
    notes: vine.string().trim().nullable().optional(),
  })
)

export const createRackAccessoryValidator = vine.compile(
  vine.object({
    projectId: vine.string().uuid(),
    containerId: vine.string().uuid(),
    accessoryTemplateId: vine.string().uuid().nullable().optional(),
    name: vine.string().trim().minLength(1).maxLength(255),
    kind: kind.optional(),
    unitStart: vine.number().min(1).max(60),
    heightU,
    mountType,
    deviceSlotCount: deviceSlotCount.optional(),
    face: face.nullable().optional(),
    horizontalSlotStart: horizontalSlotStart.optional(),
    horizontalWidthSlots: horizontalWidthSlots.optional(),
    manufacturer: vine.string().trim().maxLength(255).optional(),
    model: vine.string().trim().maxLength(255).optional(),
    notes: vine.string().trim().optional(),
  })
)

export const updateRackAccessoryValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    unitStart: vine.number().min(1).max(60).optional(),
    heightU: heightU.optional(),
    mountType: mountType.optional(),
    deviceSlotCount: deviceSlotCount.optional(),
    face: face.nullable().optional(),
    horizontalSlotStart: horizontalSlotStart.optional(),
    horizontalWidthSlots: horizontalWidthSlots.optional(),
    manufacturer: vine.string().trim().maxLength(255).nullable().optional(),
    model: vine.string().trim().maxLength(255).nullable().optional(),
    notes: vine.string().trim().nullable().optional(),
  })
)

/** Re-export for callers that need kind-specific height bounds. */
export { shelfHeightU, hangHeightU, chassisHeightU }
