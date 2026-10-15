import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import SystemUser from '#models/system_user'
import { compareVersions, parseVersion } from '../releases/version.js'

export interface ReleaseNote {
  version: string
  title: string
  highlights: string[]
}

export interface ReleaseStatus {
  current: ReleaseNote | null
  unseen: ReleaseNote[]
  history: ReleaseNote[]
}

function changelogPath() {
  return join(dirname(fileURLToPath(import.meta.url)), '../releases/changelog.json')
}

function isNewer(version: string, than: string): boolean {
  const diff = compareVersions(version, than)
  return diff !== null && diff > 0
}

async function loadReleases(): Promise<ReleaseNote[]> {
  const raw = await readFile(changelogPath(), 'utf8')
  const parsed = JSON.parse(raw) as { releases?: unknown }
  if (!Array.isArray(parsed.releases)) return []

  const notes: ReleaseNote[] = []
  for (const item of parsed.releases) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    if (typeof row.version !== 'string' || !parseVersion(row.version)) continue
    if (typeof row.title !== 'string' || !row.title.trim()) continue
    const highlights = Array.isArray(row.highlights)
      ? row.highlights.filter((line): line is string => typeof line === 'string' && line.trim().length > 0)
      : []
    notes.push({
      version: row.version.trim(),
      title: row.title.trim(),
      highlights,
    })
  }

  notes.sort((a, b) => compareVersions(b.version, a.version) ?? 0)
  return notes
}

function unseenFor(history: ReleaseNote[], lastSeenVersion: string | null): ReleaseNote[] {
  const current = history[0]
  if (!current) return []

  const seen = lastSeenVersion?.trim() ?? ''
  if (!seen || compareVersions(seen, current.version) === null) return [current]
  if (!isNewer(current.version, seen)) return []
  return history.filter((note) => isNewer(note.version, seen))
}

export default class ReleaseService {
  async statusFor(user: SystemUser): Promise<ReleaseStatus> {
    const history = await loadReleases()
    return {
      current: history[0] ?? null,
      unseen: unseenFor(history, user.lastSeenVersion),
      history,
    }
  }

  async acknowledge(user: SystemUser): Promise<ReleaseStatus> {
    const history = await loadReleases()
    const current = history[0] ?? null
    if (current && user.lastSeenVersion !== current.version) {
      user.lastSeenVersion = current.version
      await user.save()
    }
    return {
      current,
      unseen: unseenFor(history, user.lastSeenVersion),
      history,
    }
  }
}
