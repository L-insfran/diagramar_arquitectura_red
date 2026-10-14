/** Trazo de un enlace sin tipo asignado. Coincide con el azul histórico de UTP. */
export const UNTAGGED_LINK_COLOR = '#3b82f6'

export const UNTAGGED_LINK_LABEL = 'Sin tipo'

export const STALE_LINK_COLOR = '#f59e0b'

export const STALE_LINK_DASH = '7 5'

export const LINK_LINE_STYLES = [
  'solid',
  'long_dash',
  'short_dash',
  'dotted',
  'dash_dot',
  'dash_dot_dot',
] as const

export type LinkLineStyle = (typeof LINK_LINE_STYLES)[number]

export type LinkLineStyleDef = {
  id: LinkLineStyle
  label: string
  description: string
  /** Patrón SVG. Null = continua. */
  strokeDasharray: string | null
  /** Guion/hueco en mm para la muestra de la leyenda PDF. Null = continua. */
  pdfDash: number[] | null
  /** Patrón DXF en mm: positivo trazo, negativo hueco. Null = continua. */
  dxfPattern: number[] | null
}

export const LINK_LINE_STYLE_CATALOG: readonly LinkLineStyleDef[] = [
  {
    id: 'solid',
    label: 'Continua',
    description: 'Trazo lleno, sin cortes. Es el enlace habitual y el valor por defecto.',
    strokeDasharray: null,
    pdfDash: null,
    dxfPattern: null,
  },
  {
    id: 'long_dash',
    label: 'Guiones largos',
    description:
      'Segmentos largos separados por un hueco claro. Sirve para un circuito principal, como un anillo o una troncal.',
    strokeDasharray: '14 8',
    pdfDash: [2.2, 1.2],
    dxfPattern: [1.82, -1.04],
  },
  {
    id: 'short_dash',
    label: 'Guiones cortos',
    description: 'Segmentos breves y seguidos. Sirve para un ramal o el acceso hacia equipos finales.',
    strokeDasharray: '4 3',
    pdfDash: [1.1, 0.8],
    dxfPattern: [0.52, -0.39],
  },
  {
    id: 'dotted',
    label: 'Punteada',
    description: 'Puntos separados. Sirve para un enlace provisorio, inalámbrico o todavía no tendido.',
    strokeDasharray: '1.5 3.5',
    pdfDash: [0.35, 0.7],
    dxfPattern: [0.2, -0.46],
  },
  {
    id: 'dash_dot',
    label: 'Punto y raya',
    description:
      'Un trazo largo, un punto, y se repite. Sirve para un respaldo o un segundo circuito junto a uno continuo.',
    strokeDasharray: '12 4 2 4',
    pdfDash: [2, 0.6, 0.4, 0.6],
    dxfPattern: [1.56, -0.52, 0.26, -0.52],
  },
  {
    id: 'dash_dot_dot',
    label: 'Dos puntos y raya',
    description:
      'Un trazo largo y dos puntos. Sirve para un tercer camino cuando ya se usan continua y punto y raya.',
    strokeDasharray: '14 4 2 4 2 4',
    pdfDash: [1.8, 0.5, 0.35, 0.45, 0.35, 0.5],
    dxfPattern: [1.82, -0.52, 0.26, -0.52, 0.26, -0.52],
  },
]

const STYLE_BY_ID = new Map(LINK_LINE_STYLE_CATALOG.map((style) => [style.id, style]))

export function normalizeLinkLineStyle(value: string | null | undefined): LinkLineStyle {
  const normalized = value?.trim().toLowerCase()
  if (normalized && STYLE_BY_ID.has(normalized as LinkLineStyle)) {
    return normalized as LinkLineStyle
  }
  return 'solid'
}

export function linkLineStyleDef(value: string | null | undefined): LinkLineStyleDef {
  return STYLE_BY_ID.get(normalizeLinkLineStyle(value)) ?? LINK_LINE_STYLE_CATALOG[0]
}

/** Patrón del trazo. La ruta desactualizada usa guiones ámbar por encima del tipo. */
export function linkStrokeDasharray(
  lineStyle: string | null | undefined,
  stale = false
): string | undefined {
  if (stale) return STALE_LINK_DASH
  return linkLineStyleDef(lineStyle).strokeDasharray ?? undefined
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

export function normalizeLinkColor(color: string | null | undefined): string | null {
  if (!color) return null
  const value = color.trim()
  return HEX_COLOR.test(value) ? value.toLowerCase() : null
}

/** Color del trazo. La ruta desactualizada se pinta en ámbar por encima del tipo. */
export function linkStrokeColor(
  linkTypeColor: string | null | undefined,
  stale = false
): string {
  if (stale) return STALE_LINK_COLOR
  return normalizeLinkColor(linkTypeColor) ?? UNTAGGED_LINK_COLOR
}

export type LinkTypeLegendItem = {
  key: string
  label: string
  color: string
  lineStyle: LinkLineStyle
}

export function collectLinkTypeLegend(
  edges: Array<{
    linkTypeId?: string | null
    linkTypeName?: string | null
    linkTypeColor?: string | null
    linkTypeLineStyle?: string | null
  }>
): LinkTypeLegendItem[] {
  const typed = new Map<string, LinkTypeLegendItem>()
  let untyped = false
  for (const edge of edges) {
    const color = normalizeLinkColor(edge.linkTypeColor)
    if (!edge.linkTypeId || !color) {
      untyped = true
      continue
    }
    if (!typed.has(edge.linkTypeId)) {
      typed.set(edge.linkTypeId, {
        key: edge.linkTypeId,
        label: edge.linkTypeName?.trim() || 'Tipo',
        color,
        lineStyle: normalizeLinkLineStyle(edge.linkTypeLineStyle),
      })
    }
  }
  const items = [...typed.values()].sort((a, b) => a.label.localeCompare(b.label, 'es'))
  if (untyped) {
    items.push({
      key: 'untagged',
      label: UNTAGGED_LINK_LABEL,
      color: UNTAGGED_LINK_COLOR,
      lineStyle: 'solid',
    })
  }
  return items
}
