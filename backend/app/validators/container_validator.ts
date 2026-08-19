import vine from '@vinejs/vine'

export const createContainerValidator = vine.compile(
  vine.object({
    projectId: vine.string().uuid(),
    areaId: vine.string().uuid(),
    kind: vine.enum(['default', 'rack', 'board']),
    name: vine.string().trim().minLength(1).maxLength(255),
    code: vine.string().trim().maxLength(100).optional(),
    manufacturer: vine.string().trim().maxLength(255).optional(),
    model: vine.string().trim().maxLength(255).optional(),
    notes: vine.string().trim().optional(),
    heightU: vine.number().min(1).max(60).optional(),
    boardKind: vine.enum(['electrical', 'communications', 'generic']).optional(),
    gridRows: vine.number().min(1).max(100).optional(),
    gridCols: vine.number().min(1).max(100).optional(),
  })
)

export const updateContainerValidator = vine.compile(
  vine.object({
    kind: vine.enum(['default', 'rack', 'board']).optional(),
    areaId: vine.string().uuid().optional(),
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    code: vine.string().trim().maxLength(100).nullable().optional(),
    manufacturer: vine.string().trim().maxLength(255).nullable().optional(),
    model: vine.string().trim().maxLength(255).nullable().optional(),
    notes: vine.string().trim().nullable().optional(),
    heightU: vine.number().min(1).max(60).nullable().optional(),
    boardKind: vine.enum(['electrical', 'communications', 'generic']).nullable().optional(),
    gridRows: vine.number().min(1).max(100).nullable().optional(),
    gridCols: vine.number().min(1).max(100).nullable().optional(),
  })
)
