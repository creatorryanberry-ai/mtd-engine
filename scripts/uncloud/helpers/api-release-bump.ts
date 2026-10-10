export type SemverBump = 'patch' | 'minor' | 'major'

export function parseSemver(version: string): [number, number, number] {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version.trim())
  if (!match) {
    throw new Error(`invalid semver: ${version}`)
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

/** negative if a < b, 0 if equal, positive if a > b */
export function compareSemver(a: string, b: string): number {
  const [aMaj, aMin, aPatch] = parseSemver(a)
  const [bMaj, bMin, bPatch] = parseSemver(b)
  if (aMaj !== bMaj) return aMaj - bMaj
  if (aMin !== bMin) return aMin - bMin
  return aPatch - bPatch
}

export function bumpSemver(version: string, kind: SemverBump): string {
  const [maj, min, patch] = parseSemver(version)
  if (kind === 'major') return `${maj + 1}.0.0`
  if (kind === 'minor') return `${maj}.${min + 1}.0`
  return `${maj}.${min}.${patch + 1}`
}

export function resolveBumpChoice(current: string, input: string): string | 'skip' {
  const trimmed = input.trim().toLowerCase()
  if (trimmed === '' || trimmed === 'patch') return bumpSemver(current, 'patch')
  if (trimmed === 'minor') return bumpSemver(current, 'minor')
  if (trimmed === 'major') return bumpSemver(current, 'major')
  if (trimmed === 'skip') return 'skip'
  // exact x.y.z
  parseSemver(trimmed) // throws if invalid
  if (compareSemver(trimmed, current) <= 0) {
    throw new Error(`new version ${trimmed} must be greater than current ${current}`)
  }
  return trimmed
}

export async function promptApiReleaseBump(
  current: string,
  opts?: { readLine?: () => Promise<string> },
): Promise<string> {
  const nextPatch = bumpSemver(current, 'patch')
  process.stdout.write(
    `\napi inputs changed since last deploy.\n` +
      `current API_RELEASE_VERSION: ${current}\n` +
      `bump? [patch → ${nextPatch}] / minor / major / <x.y.z> / skip\n> `,
  )
  const readLine =
    opts?.readLine ??
    (async () => {
      const chunks: Buffer[] = []
      for await (const chunk of process.stdin) {
        chunks.push(Buffer.from(chunk))
        if (chunk.toString().includes('\n')) break
      }
      return Buffer.concat(chunks).toString('utf8')
    })
  const answer = await readLine()
  const resolved = resolveBumpChoice(current, answer)
  if (resolved === 'skip') {
    throw new Error(
      'deploy aborted (skip) — bump API_RELEASE_VERSION to ship api changes',
    )
  }
  return resolved
}
