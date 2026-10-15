export type ReleaseBump = 'major' | 'minor' | 'patch'

const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/

export function parseVersion(value: string): [number, number, number] | null {
  const match = VERSION_PATTERN.exec(value.trim())
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

/** Positivo si `left` es más nueva que `right`. Null si alguna no es major.minor.patch. */
export function compareVersions(left: string, right: string): number | null {
  const a = parseVersion(left)
  const b = parseVersion(right)
  if (!a || !b) return null
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index]
  }
  return 0
}

export function bumpVersion(version: string, level: ReleaseBump): string {
  const parts = parseVersion(version)
  if (!parts) {
    throw new Error(`La versión "${version}" no es major.minor.patch`)
  }
  const [major, minor, patch] = parts
  if (level === 'major') return `${major + 1}.0.0`
  if (level === 'minor') return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}
