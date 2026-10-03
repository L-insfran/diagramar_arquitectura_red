/**
 * Tipografía del diagrama de conexiones — legible en pantalla y en impresión A4.
 * Objetivo: ≥ ~2 mm en papel a la escala de captura (TARGET_MM_PER_FLOW_PX).
 */

/** Etiquetas de puerto (inline en handleAnchor). */
export const DIAGRAM_PORT_LABEL_PX = 14
export const DIAGRAM_PORT_LABEL_LINE_PX = 16

/** text-base. El DXF convierte estos px con `TARGET_MM_PER_FLOW_PX`. */
export const DIAGRAM_CONTAINER_TITLE_PX = 16
export const DIAGRAM_CONTAINER_TITLE =
  'text-base font-semibold leading-tight tracking-tight'
export const DIAGRAM_CONTAINER_BADGE =
  'text-[11px] font-semibold uppercase tracking-wider'
export const DIAGRAM_CONTAINER_SUBTITLE = 'text-xs leading-snug'

/** text-base. Alto de glifo del nombre; la línea del encabezado mide 22 px. */
export const DIAGRAM_DEVICE_NAME_PX = 16
export const DIAGRAM_DEVICE_NAME = 'text-base font-semibold leading-[22px]'
/** text-[11px]: tipo e IP bajo el nombre. */
export const DIAGRAM_DEVICE_META_PX = 11
export const DIAGRAM_DEVICE_META = 'text-[11px] tabular-nums'

/** Códigos de enlace (E1, E30…) sobre el cable. text-sm. */
export const DIAGRAM_LINK_REF_PX = 14
export const DIAGRAM_LINK_REF =
  'text-sm font-bold leading-none'

export const DIAGRAM_EMPTY_HINT = 'text-xs'

/** Aprox. px por carácter para estimar líneas de nombre (text-base semibold). */
export const DIAGRAM_DEVICE_CHAR_PX = 8.8
