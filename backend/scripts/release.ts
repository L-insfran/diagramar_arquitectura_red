import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  bumpVersion,
  compareVersions,
  parseVersion,
  type ReleaseBump,
} from '../app/releases/version.js'

const CHANGELOG_PATH = 'backend/app/releases/changelog.json'
const MAX_HIGHLIGHTS = 15
const CONVENTIONAL_PREFIX =
  /^(?:feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert)(?:\([^)]+\))?!:?\s+/i

interface ChangelogRelease {
  version: string
  title: string
  highlights: string[]
}

interface ChangelogFile {
  releases: ChangelogRelease[]
}

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function repoRoot(): string {
  return git(process.cwd(), ['rev-parse', '--show-toplevel']).trim()
}

function parseBump(argv: string[]): ReleaseBump {
  const args = argv.filter((arg) => arg !== '--')
  if (args.length === 0) return 'patch'
  const level = args[0]
  if (args.length === 1 && (level === 'patch' || level === 'minor' || level === 'major')) {
    return level
  }
  throw new Error('Uso: npm run release -- [patch|minor|major]')
}

function tagExists(root: string, tag: string): boolean {
  try {
    git(root, ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`])
    return true
  } catch {
    return false
  }
}

function highestVersion(releases: ChangelogRelease[]): string {
  let best: string | null = null
  for (const release of releases) {
    if (typeof release.version !== 'string' || !parseVersion(release.version)) continue
    if (!best || (compareVersions(release.version, best) ?? 0) > 0) {
      best = release.version.trim()
    }
  }
  if (!best) {
    throw new Error('El changelog no tiene una versión major.minor.patch')
  }
  return best
}

function changelogIntroducedAt(root: string): string | null {
  const hash = git(root, [
    'log',
    '-1',
    '--diff-filter=A',
    '--format=%H',
    '--',
    CHANGELOG_PATH,
  ]).trim()
  return hash || null
}

function commitSubjects(root: string, range: string): string[] {
  const output = git(root, ['log', range, '--no-merges', '--format=%s'])
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

function highlightLines(subjects: string[]): string[] {
  const lines = subjects
    .filter((subject) => !/^release:/i.test(subject))
    .map((subject) => subject.replace(CONVENTIONAL_PREFIX, '').trim())
    .filter((line) => line.length > 0)

  if (lines.length <= MAX_HIGHLIGHTS) return lines
  const shown = lines.slice(0, MAX_HIGHLIGHTS - 1)
  const hidden = lines.length - shown.length
  const extra = hidden === 1 ? 'y 1 cambio más' : `y ${hidden} cambios más`
  return [...shown, extra]
}

async function main() {
  const level = parseBump(process.argv.slice(2))
  const root = repoRoot()

  if (git(root, ['status', '--porcelain']).trim().length > 0) {
    throw new Error('Hay cambios sin commitear. El release solo corre con el working tree limpio.')
  }

  const changelogFile = join(root, CHANGELOG_PATH)
  const parsed = JSON.parse(await readFile(changelogFile, 'utf8')) as ChangelogFile
  if (!parsed || !Array.isArray(parsed.releases)) {
    throw new Error('El changelog no tiene un array releases')
  }

  const current = highestVersion(parsed.releases)
  const currentTag = `v${current}`
  const hasTag = tagExists(root, currentTag)
  let range = `${currentTag}..HEAD`
  let since = currentTag

  if (!hasTag) {
    const introduced = changelogIntroducedAt(root)
    if (!introduced) {
      throw new Error(
        'No hay un commit que haya agregado el changelog. Commitealo antes de publicar.'
      )
    }
    range = `${introduced}..HEAD`
    since = 'el commit que agregó el changelog'
  }

  const highlights = highlightLines(commitSubjects(root, range))
  if (highlights.length === 0) {
    console.log(`No hay commits nuevos desde ${since}. No se publicó nada.`)
    return
  }

  const next = bumpVersion(current, level)
  const nextTag = `v${next}`
  if (tagExists(root, nextTag)) {
    throw new Error(`El tag ${nextTag} ya existe.`)
  }

  parsed.releases.unshift({
    version: next,
    title: `Versión ${next}`,
    highlights,
  })
  await writeFile(changelogFile, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8')

  execFileSync('git', ['commit', '-m', `release: ${nextTag}`, '--', CHANGELOG_PATH], {
    cwd: root,
    stdio: 'inherit',
  })
  execFileSync('git', ['tag', nextTag], {
    cwd: root,
    stdio: 'inherit',
  })

  console.log(`Publicada ${nextTag}.`)
  for (const line of highlights) {
    console.log(`- ${line}`)
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exit(1)
})
