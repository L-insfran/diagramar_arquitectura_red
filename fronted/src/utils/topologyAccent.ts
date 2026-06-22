/** Distinct accent colors for topology nodes / port labels (WCAG-friendly saturation). */
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

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

/** Stable color per device id so the same node keeps the same hue across reloads. */
export function accentColorForNodeId(nodeId: string): string {
  return ACCENT_PALETTE[hashString(nodeId) % ACCENT_PALETTE.length]!
}
