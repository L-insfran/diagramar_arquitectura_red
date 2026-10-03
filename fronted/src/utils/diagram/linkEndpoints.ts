/** Un extremo de un enlace de diagrama (equipo + puerto + etiqueta). */
export type LinkEndpointDraft = {
  deviceId: string
  portId: string
  portLabel: string
}

/**
 * Intercambia origen y destino. Es involutiva: aplicarla dos veces
 * restaura el par original. Los campos extra del extremo (por ejemplo
 * si el equipo está bloqueado) viajan con él.
 */
export function swapLinkEndpoints<T extends LinkEndpointDraft>(
  source: T,
  target: T
): { source: T; target: T } {
  return { source: target, target: source }
}
