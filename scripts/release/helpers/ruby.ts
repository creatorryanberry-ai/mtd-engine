#!/usr/bin/env bun

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export type RubyEnv = {
  env: Record<string, string>
  /** absolute path to managed-ruby `bundle` — bun `$` often ignores PATH for lookup */
  bundle: string
}

type ManagedRuby = {
  /** e.g. 3.3.5 */
  version: string
  /** .../bin containing ruby + bundle */
  rubyBin: string
  /** chruby | rbenv — affects where `gem install` lands */
  manager: 'chruby' | 'rbenv'
}

function wantedRubyPrefix(cwd: string): string | null {
  const versionFile = join(cwd, '.ruby-version')
  if (!existsSync(versionFile)) return null
  const wanted = readFileSync(versionFile, 'utf-8').trim()
  return wanted || null
}

function sortVersionsDesc(a: string, b: string) {
  const av = a.split('.').map(Number)
  const bv = b.split('.').map(Number)
  for (let i = 0; i < Math.max(av.length, bv.length); i++) {
    const d = (bv[i] || 0) - (av[i] || 0)
    if (d) return d
  }
  return 0
}

/** chruby (~/.rubies/ruby-3.3.5) + rbenv (~/.rbenv/versions/3.3.5), highest patch first */
function listManagedRubies(cwd: string): ManagedRuby[] {
  const wanted = wantedRubyPrefix(cwd)
  if (!wanted) return []

  const out: ManagedRuby[] = []
  const home = homedir()

  const rubiesDir = join(home, '.rubies')
  if (existsSync(rubiesDir)) {
    for (const name of readdirSync(rubiesDir)) {
      if (!name.startsWith('ruby-')) continue
      const version = name.slice('ruby-'.length)
      if (!version.startsWith(wanted)) continue
      const rubyBin = join(rubiesDir, name, 'bin')
      if (!existsSync(join(rubyBin, 'ruby'))) continue
      out.push({ version, rubyBin, manager: 'chruby' })
    }
  }

  const rbenvVersions = join(home, '.rbenv', 'versions')
  if (existsSync(rbenvVersions)) {
    for (const version of readdirSync(rbenvVersions)) {
      if (!version.startsWith(wanted)) continue
      const rubyBin = join(rbenvVersions, version, 'bin')
      if (!existsSync(join(rubyBin, 'ruby'))) continue
      out.push({ version, rubyBin, manager: 'rbenv' })
    }
  }

  return out.sort((a, b) => sortVersionsDesc(a.version, b.version))
}

function rubyDefaultGemsDir(rubyBin: string): string | undefined {
  const rubyGemsRoot = join(rubyBin, '..', 'lib', 'ruby', 'gems')
  if (!existsSync(rubyGemsRoot)) return undefined
  return readdirSync(rubyGemsRoot)
    .map((name) => join(rubyGemsRoot, name))
    .find((dir) => existsSync(dir))
}

function ensureUtf8Locale(env: Record<string, string>) {
  if (!env.LANG?.toLowerCase().includes('utf-8')) {
    env.LANG = 'en_US.UTF-8'
  }
  if (!env.LC_ALL?.toLowerCase().includes('utf-8')) {
    env.LC_ALL = 'en_US.UTF-8'
  }
}

/**
 * bun/IDE shells often skip chruby/rbenv, so `bundle` resolves to system Ruby 2.6
 * while Gemfile.lock + vendor/bundle target the version in .ruby-version
 * (3.3.x). prepend that ruby's bin and return an absolute `bundle` path —
 * bun's `$` command lookup frequently ignores a custom PATH.
 */
export function resolveRubyEnv(
  cwd: string,
  baseEnv: Record<string, string | undefined> = process.env,
): RubyEnv {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(baseEnv)) {
    if (value !== undefined) env[key] = value
  }

  const managed = listManagedRubies(cwd)[0]
  if (!managed) return { env, bundle: 'bundle' }

  const bundle = join(managed.rubyBin, 'bundle')
  if (!existsSync(bundle)) {
    return { env, bundle: 'bundle' }
  }

  // drop ruby-manager gem paths so bundler uses vendor/bundle for this ruby
  delete env.GEM_HOME
  delete env.GEM_PATH
  delete env.RUBYOPT
  delete env.RUBYLIB

  env.PATH = `${managed.rubyBin}:${env.PATH || ''}`
  ensureUtf8Locale(env)
  return { env, bundle }
}

export type PodInstall = {
  /** absolute path to managed-ruby `pod` when present */
  pod: string
  env: Record<string, string>
}

type PodLocation = {
  pod: string
  gemHome: string
  gemPath: string
  pathPrefix: string
}

function resolvePodLocation(ruby: ManagedRuby): PodLocation | null {
  const defaultGems = rubyDefaultGemsDir(ruby.rubyBin)
  const userGemHome = join(homedir(), '.gem', 'ruby', ruby.version)
  const userPod = join(userGemHome, 'bin', 'pod')
  // rbenv default: gems install into the version prefix
  const versionPod = join(ruby.rubyBin, 'pod')
  const versionGemHome = join(ruby.rubyBin, '..')

  if (existsSync(userPod)) {
    return {
      pod: userPod,
      gemHome: userGemHome,
      gemPath: defaultGems ? `${userGemHome}:${defaultGems}` : userGemHome,
      pathPrefix: `${userGemHome}/bin:${ruby.rubyBin}`,
    }
  }

  if (existsSync(versionPod)) {
    const gemHome = defaultGems || versionGemHome
    return {
      pod: versionPod,
      gemHome,
      gemPath: defaultGems || gemHome,
      pathPrefix: ruby.rubyBin,
    }
  }

  return null
}

/**
 * cocoapods via chruby user gem (~/.gem/ruby/<ver>/) or rbenv version gems
 * (~/.rbenv/versions/<ver>/bin/pod). keep GEM_HOME/PATH so the binstub can
 * activate — scrubbing GEM_* (as we do for bundle/fastlane) breaks `pod`.
 */
export function resolvePodInstall(
  cwd: string,
  baseEnv: Record<string, string | undefined> = process.env,
): PodInstall {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(baseEnv)) {
    if (value !== undefined) env[key] = value
  }

  delete env.RUBYOPT
  delete env.RUBYLIB

  const candidates = listManagedRubies(cwd)
  if (!candidates.length) {
    return { pod: 'pod', env }
  }

  const withPod = candidates
    .map((ruby) => ({ ruby, loc: resolvePodLocation(ruby) }))
    .find((x) => x.loc)

  if (!withPod?.loc) {
    const hint = candidates[0]!
    const how =
      hint.manager === 'rbenv'
        ? `rbenv shell ${hint.version} && gem install cocoapods`
        : `chruby ${hint.version} && gem install cocoapods`
    throw new Error(
      `cocoapods not found for ruby ${hint.version} (${hint.manager}).\n` +
        `install with: ${how}`,
    )
  }

  const { loc } = withPod
  env.GEM_HOME = loc.gemHome
  env.GEM_PATH = loc.gemPath
  env.PATH = `${loc.pathPrefix}:${env.PATH || ''}`
  ensureUtf8Locale(env)

  return { pod: loc.pod, env }
}
