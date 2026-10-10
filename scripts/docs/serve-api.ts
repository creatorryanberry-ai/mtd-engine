#!/usr/bin/env bun
/**
 * @description Serve the OpenAPI spec with Scalar (standalone, like Storybook).
 */
import { existsSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const root = resolve(import.meta.dir, '../..')
const port = process.env.VITE_PORT_API_DOCS ?? '6007'
const viteBin = resolve(root, 'node_modules/.bin/vite')

function portInUse(checkPort: string) {
  const result = spawnSync('lsof', ['-ti', `:${checkPort}`], { encoding: 'utf8' })
  return Boolean(result.stdout?.trim())
}

if (portInUse(port)) {
  console.info(`api docs already running → http://localhost:${port}/docs/`)
  console.info(`stop it with: kill $(lsof -ti :${port})`)
  process.exit(0)
}

console.info(`regenerating openapi spec…`)
const gen = spawn('bun', ['run', './scripts/docs/gen-openapi.ts'], {
  cwd: root,
  stdio: 'inherit',
})

gen.on('exit', (code) => {
  if (code !== 0) process.exit(code ?? 1)

  if (!existsSync(viteBin)) {
    console.error(`missing vite — run: bun install`)
    process.exit(1)
  }

  console.info(`api docs → http://localhost:${port}/docs/`)
  const serve = spawn(viteBin, ['--config', 'api-docs/vite.config.ts'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, VITE_PORT_API_DOCS: port },
  })

  serve.on('exit', (serveCode) => process.exit(serveCode ?? 0))
})
