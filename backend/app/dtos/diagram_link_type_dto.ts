import type { DiagramLinkLineStyle } from '#models/diagram_link_type'

export type { DiagramLinkLineStyle }

const LINE_STYLES: readonly DiagramLinkLineStyle[] = [
  'solid',
  'long_dash',
  'short_dash',
  'dotted',
  'dash_dot',
  'dash_dot_dot',
]

export function normalizeDiagramLinkLineStyle(
  value: string | null | undefined
): DiagramLinkLineStyle {
  const normalized = value?.trim().toLowerCase()
  if (normalized && LINE_STYLES.includes(normalized as DiagramLinkLineStyle)) {
    return normalized as DiagramLinkLineStyle
  }
  return 'solid'
}

export type CreateDiagramLinkTypeInput = {
  projectId: string
  name: string
  color: string
  description?: string | null
  sortOrder?: number
  isDefault?: boolean
  lineStyle?: DiagramLinkLineStyle
}

export type UpdateDiagramLinkTypeInput = {
  name?: string
  color?: string
  description?: string | null
  sortOrder?: number
  isDefault?: boolean
  lineStyle?: DiagramLinkLineStyle
}

export type DiagramLinkTypeApi = {
  id: string
  projectId: string
  name: string
  color: string
  description: string | null
  sortOrder: number
  isDefault: boolean
  lineStyle: DiagramLinkLineStyle
  createdAt: string | null
  updatedAt: string | null
}
