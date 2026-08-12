import vine from '@vinejs/vine'

const boardKind = vine.enum(['electrical', 'communications', 'generic'] as const)

export const createBoardValidator = vine.compile(
  vine.object({
    projectId: vine.string().uuid(),
    areaId: vine.string().uuid(),
    name: vine.string().trim().minLength(1).maxLength(255),
    code: vine.string().trim().maxLength(100).optional(),
    kind: boardKind.clone().optional(),
    gridRows: vine.number().min(1).max(40).optional(),
    gridCols: vine.number().min(1).max(40).optional(),
    manufacturer: vine.string().trim().maxLength(255).optional(),
    model: vine.string().trim().maxLength(255).optional(),
    notes: vine.string().trim().optional(),
  })
)

export const updateBoardValidator = vine.compile(
  vine.object({
    areaId: vine.string().uuid().optional(),
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    code: vine.string().trim().maxLength(100).nullable().optional(),
    kind: boardKind.clone().optional(),
    gridRows: vine.number().min(1).max(40).optional(),
    gridCols: vine.number().min(1).max(40).optional(),
    manufacturer: vine.string().trim().maxLength(255).nullable().optional(),
    model: vine.string().trim().maxLength(255).nullable().optional(),
    notes: vine.string().trim().nullable().optional(),
  })
)
