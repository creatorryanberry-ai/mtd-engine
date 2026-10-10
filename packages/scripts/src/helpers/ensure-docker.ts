import { existsSync } from 'node:fs'
import { platform } from 'node:os'

import { sleep } from '@mtd/helpers'

import { run } from './run'

async function isDockerReady(): Promise<boolean> {
  try {
    await run('docker info', { silent: true })
    return true
  } catch {
    return false
  }
}

async function hasCommand(name: string): Promise<boolean> {
  try {
    await run(`command -v ${name}`, { silent: true })
    return true
  } catch {
    return false
  }
}

async function detectRuntime(): Promise<'orbstack' | 'docker-desktop' | null> {
  if (
    existsSync('/Applications/OrbStack.app') ||
    (await hasCommand('orb')) ||
    (await hasCommand('orbctl'))
  ) {
    return 'orbstack'
  }
  if (existsSync('/Applications/Docker.app')) {
    return 'docker-desktop'
  }
  return null
}

async function startRuntime(runtime: 'orbstack' | 'docker-desktop'): Promise<void> {
  if (platform() !== 'darwin') {
    throw new Error('docker daemon is not running. start the docker service and retry.')
  }

  const app = runtime === 'orbstack' ? 'OrbStack' : 'Docker'
  console.info(`   opening ${app}...`)
  try {
    await run(`/usr/bin/open -a ${app}`, { silent: true })
  } catch {
    throw new Error(`could not open ${app}. start it manually, then retry the deploy.`)
  }
}

/**
 * ensure the local docker daemon is reachable before builds/pushes.
 * on macOS, auto-opens OrbStack (preferred) or Docker Desktop when the socket is down.
 */
export async function ensureDockerDaemon(options?: {
  timeoutMs?: number
}): Promise<void> {
  if (await isDockerReady()) return

  const timeoutMs = options?.timeoutMs ?? 60_000
  const runtime = await detectRuntime()

  if (!runtime) {
    throw new Error(
      'docker daemon is not running and no OrbStack/Docker Desktop install was found. install OrbStack (brew install --cask orbstack) and retry.',
    )
  }

  console.info(`🐳 docker daemon not running — starting ${runtime}...`)
  await startRuntime(runtime)

  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (await isDockerReady()) {
      console.info('✅ docker daemon ready')
      return
    }
    await sleep(1000)
  }

  throw new Error(
    `timed out waiting for docker daemon after starting ${runtime}. open it manually and retry.`,
  )
}
