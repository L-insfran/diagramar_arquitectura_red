/**
 * Extrae grupos numéricos de una etiqueta de puerto (p. ej. "P06" → [6], "Gi0/21" → [0, 21])
 * para ordenar de forma natural de menor a mayor.
 */
export function portLabelNumericGroups(label: string): number[] {
  const matches = label.match(/\d+/g)
  if (!matches?.length) return [Number.MAX_SAFE_INTEGER]
  return matches.map((m) => parseInt(m, 10))
}

function compareNumericGroups(a: number[], b: number[]): number {
  const n = Math.max(a.length, b.length)
  for (let i = 0; i < n; i++) {
    const av = a[i] ?? 0
    const bv = b[i] ?? 0
    if (av !== bv) return av - bv
  }
  return 0
}

/** Ordena de menor a mayor por puerto origen y, a igualdad, por puerto destino. */
export function compareTopologyPortPair(
  sourceA: string,
  targetA: string,
  sourceB: string,
  targetB: string
): number {
  let c = compareNumericGroups(portLabelNumericGroups(sourceA), portLabelNumericGroups(sourceB))
  if (c !== 0) return c
  c = compareNumericGroups(portLabelNumericGroups(targetA), portLabelNumericGroups(targetB))
  if (c !== 0) return c
  c = sourceA.localeCompare(sourceB, undefined, { numeric: true, sensitivity: 'base' })
  if (c !== 0) return c
  return targetA.localeCompare(targetB, undefined, { numeric: true, sensitivity: 'base' })
}
