import vine from '@vinejs/vine'
import type { DiagramLinkLineStyle } from '#models/diagram_link_type'

const hexColor = () => vine.string().trim().regex(/^#[0-9A-Fa-f]{6}$/)
const LINE_STYLES = [
  'solid',
  'long_dash',
  'short_dash',
  'dotted',
  'dash_dot',
  'dash_dot_dot',
] as const satisfies readonly DiagramLinkLineStyle[]
const lineStyle = () => vine.enum(LINE_STYLES)

export const createDiagramLinkTypeValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(80),
    color: hexColor(),
    description: vine.string().trim().maxLength(500).nullable().optional(),
    sortOrder: vine.number().min(0).max(10000).optional(),
    isDefault: vine.boolean().optional(),
    lineStyle: lineStyle().optional(),
  })
)

export const updateDiagramLinkTypeValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(80).optional(),
    color: hexColor().optional(),
    description: vine.string().trim().maxLength(500).nullable().optional(),
    sortOrder: vine.number().min(0).max(10000).optional(),
    isDefault: vine.boolean().optional(),
    lineStyle: lineStyle().optional(),
  })
)
