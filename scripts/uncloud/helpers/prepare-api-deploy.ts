import { readApiDeployState, writeApiDeployState } from './api-deploy-state'
import { computeApiFingerprint } from './api-fingerprint'
import {
  compareSemver,
  promptApiReleaseBump,
  resolveBumpChoice,
} from './api-release-bump'
import { readApiReleaseVersion, writeApiReleaseVersion } from './api-release-file'

export type PrepareApiDeployResult =
  | { action: 'skip'; fingerprint: string; apiRelease: string }
  | { action: 'deploy'; fingerprint: string; apiRelease: string }

function parseDeployFlags(argv: string[]) {
  const bumpArg = argv.find((a) => a.startsWith('--bump='))
  const bumpFlagIdx = argv.indexOf('--bump')
  const bumpFromFlag =
    bumpFlagIdx >= 0 && argv[bumpFlagIdx + 1] && !argv[bumpFlagIdx + 1]!.startsWith('-')
      ? argv[bumpFlagIdx + 1]
      : undefined
  const bump = bumpArg?.slice('--bump='.length) || bumpFromFlag

  return {
    force: argv.includes('--force'),
    skipUnchanged: !argv.includes('--no-skip-unchanged'),
    nonInteractive:
      argv.includes('--non-interactive') ||
      process.env.CI === '1' ||
      !process.stdin.isTTY,
    bump,
  }
}

async function ensureReleaseBumped(opts: {
  repoRoot: string
  current: string
  bumpFlag?: string
  nonInteractive: boolean
}): Promise<string> {
  if (opts.bumpFlag) {
    const resolved = resolveBumpChoice(opts.current, opts.bumpFlag)
    if (resolved === 'skip') {
      throw new Error('deploy aborted (--bump skip)')
    }
    writeApiReleaseVersion(opts.repoRoot, resolved)
    return resolved
  }
  if (opts.nonInteractive) {
    throw new Error(
      `api inputs changed but API_RELEASE_VERSION is still ${opts.current}.\n` +
        `bump with --bump patch|minor|major (or deploy interactively).`,
    )
  }
  const next = await promptApiReleaseBump(opts.current)
  writeApiReleaseVersion(opts.repoRoot, next)
  return next
}

/**
 * decide whether to skip api deploy or bump release version first.
 * call recordApiDeploySuccess after a successful deploy.
 */
export async function prepareApiDeploy(opts: {
  repoRoot: string
  target: 'staging' | 'production'
  argv?: string[]
}): Promise<PrepareApiDeployResult> {
  const argv = opts.argv ?? process.argv.slice(2)
  const flags = parseDeployFlags(argv)
  let fingerprint = computeApiFingerprint(opts.repoRoot)
  let apiRelease = readApiReleaseVersion(opts.repoRoot)
  const last = readApiDeployState(opts.repoRoot, opts.target)

  const unchanged = last?.fingerprint === fingerprint
  if (unchanged && flags.skipUnchanged && !flags.force) {
    console.info(
      `api unchanged (fingerprint match, release ${apiRelease}) — skipping deploy`,
    )
    return { action: 'skip', fingerprint, apiRelease }
  }

  if (flags.force && unchanged) {
    console.info('api fingerprint unchanged but --force set — deploying anyway')
  }

  // fingerprint moved (or first deploy with no state): require release > last when we have history
  if (!unchanged && last && compareSemver(apiRelease, last.apiRelease) <= 0) {
    apiRelease = await ensureReleaseBumped({
      repoRoot: opts.repoRoot,
      current: apiRelease,
      bumpFlag: flags.bump,
      nonInteractive: flags.nonInteractive,
    })
    fingerprint = computeApiFingerprint(opts.repoRoot)
  } else if (!last) {
    console.info(`first tracked api deploy for ${opts.target} (release ${apiRelease})`)
  }

  return { action: 'deploy', fingerprint, apiRelease }
}

export function recordApiDeploySuccess(opts: {
  repoRoot: string
  target: 'staging' | 'production'
  fingerprint: string
  apiRelease: string
  gitSha: string
}) {
  writeApiDeployState(opts.repoRoot, opts.target, {
    fingerprint: opts.fingerprint,
    apiRelease: opts.apiRelease,
    gitSha: opts.gitSha,
    deployedAt: new Date().toISOString(),
  })
}
