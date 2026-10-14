/** Distinct accent colors for diagram device nodes (saturated, readable on light and dark). */
const ACCENT_PALETTE = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
  '#84cc16',
  '#6366f1',
  '#14b8a6',
  '#ef4444',
  '#a855f7',
] as const

/** Equipos sin tipo de catálogo: un solo acento, para no parecer aleatorios. */
export const UNTYPED_DEVICE_ACCENT = '#64748b'

export function deviceTypeColorKey(deviceType: string | null | undefined): string {
  return (deviceType ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Un color por tipo de equipo.
 * El orden alfabético del nombre reparte la paleta sin depender del id de cada equipo,
 * así dos switches comparten color y un firewall no hereda el de un servidor por azar.
 */
export function accentColorsByDeviceType(
  deviceTypes: Iterable<string | null | undefined>
): Map<string, string> {
  const keys = new Set<string>()
  for (const deviceType of deviceTypes) {
    const key = deviceTypeColorKey(deviceType)
    if (key) keys.add(key)
  }
  const sorted = [...keys].sort((a, b) => a.localeCompare(b, 'es'))
  const colors = new Map<string, string>()
  sorted.forEach((key, index) => {
    colors.set(key, ACCENT_PALETTE[index % ACCENT_PALETTE.length]!)
  })
  return colors
}

export function accentColorForDeviceType(
  colors: Map<string, string>,
  deviceType: string | null | undefined
): string {
  const key = deviceTypeColorKey(deviceType)
  if (!key) return UNTYPED_DEVICE_ACCENT
  return colors.get(key) ?? UNTYPED_DEVICE_ACCENT
}
