#!/usr/bin/env bun

/**
 * vercel build (see docs/engine-vercel.md). produces .vercel/output with:
 * - the one web build as static spa pages
 * - a single node function serving every /api route (src/server/vercel-api-entry.ts)
 * - a routing table that sends /api/* to that function and clean urls to html
 * before building it migrates the database (skip with SKIP_DB=1) and, when
 * ENGINE_SEED_EMAIL is set, seeds the demo workspace for that email (idempotent).
 */

import '../../src/server/vercelEnv'

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative } from 'node:path'

import { $ } from 'bun'

const ROOT = join(import.meta.dir, '../..')
const OUTPUT = join(ROOT, '.vercel/output')
const FUNCTIONS = join(OUTPUT, 'functions')
const STATIC = join(OUTPUT, 'static')
const API_FUNC = join(FUNCTIONS, 'api.func')
// dynamic spa shells live here under colon-free names, outside the clean-url overrides
const DYNAMIC_DIR = '__pages'

type Route = Record<string, unknown> & { src?: string; dest?: string; handle?: string }

async function migrateAndSeed() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set: connect a postgres database to the vercel project',
    )
  }
  console.info('[vercel] running migrations')
  await $`bun run src/database/migrate.ts`.cwd(ROOT)
  const email = process.env.ENGINE_SEED_EMAIL
  if (email) {
    console.info('[vercel] seeding the demo workspace')
    await $`bun run scripts/db/seed-engine.ts --email ${email}`.cwd(ROOT)
  }
}

function listHtml(dir: string, out: string[] = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (full === join(STATIC, DYNAMIC_DIR)) continue
    if (statSync(full).isDirectory()) listHtml(full, out)
    else if (entry.endsWith('.html')) out.push(relative(STATIC, full))
  }
  return out
}

/** clean urls for prebuilt output: serve foo.html at /foo and dir/index.html at /dir */
function htmlOverrides() {
  const overrides: Record<string, { path: string }> = {}
  for (const file of listHtml(STATIC)) {
    if (file === 'index.html') continue
    const path = file.endsWith('/index.html')
      ? file.slice(0, -'/index.html'.length)
      : file.slice(0, -'.html'.length)
    overrides[file] = { path }
  }
  return overrides
}

/**
 * one points dynamic pages at route source names (foo/:id.tsx). move the
 * emitted html shell to a colon-free path so the rewrite target is literal.
 */
function pageDest(dest: string) {
  const html = dest.split('?')[0]!.replace(/\.tsx$/, '.html')
  if (!html.includes(':')) return html
  const target = `/${DYNAMIC_DIR}${html.replace(/:(\w+)/g, '_$1_')}`
  const from = join(STATIC, html)
  if (existsSync(from)) {
    mkdirSync(dirname(join(STATIC, target)), { recursive: true })
    renameSync(from, join(STATIC, target))
  }
  if (!existsSync(join(STATIC, target))) throw new Error(`missing page html for ${dest}`)
  return target
}

/**
 * the client preloads route chunks by concrete url (engine_ws__abc_<key>_preload.js);
 * the files are named after the route pattern (engine_:workspaceId_<key>_preload.js).
 * params have their underscores doubled, so a param never spans a single underscore.
 */
function dynamicPreloadRoutes(): Route[] {
  return readdirSync(join(STATIC, 'assets'))
    .filter((file) => file.includes(':') && /_\d+_preload(_css)?\.js$/.test(file))
    .map((file) => {
      const pattern = file
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/:[A-Za-z0-9]+/g, '(?:[^_/]|__)+')
      return { src: `^/assets/${pattern}$`, dest: `/assets/${file}` }
    })
}

function rewriteRoutes(routes: Route[]): Route[] {
  const pageRoutes = routes.filter((route) => {
    if (route.middlewarePath || route.handle) return false
    if (!route.dest) return false
    return !route.dest.startsWith('/api')
  })
  const notFound = pageRoutes.filter((route) => route.dest?.includes('+not-found'))
  const pages = pageRoutes.filter((route) => !route.dest?.includes('+not-found'))
  return [
    // the original path rides along so the router sees it even if vercel rewrites req.url
    { src: '^/api(/.*)?$', dest: '/api?__vercel_path=/api$1' },
    { handle: 'filesystem' },
    ...dynamicPreloadRoutes(),
    ...pages.map((route) => ({ src: route.src, dest: pageDest(route.dest!) })),
    ...notFound.map((route) => ({
      src: route.src,
      dest: '/+not-found.html',
      status: 404,
    })),
  ]
}

async function buildApiFunction() {
  mkdirSync(API_FUNC, { recursive: true })
  await $`bun build src/server/vercel-api-entry.ts --target node --format esm --conditions react-server --outfile ${join(API_FUNC, 'index.mjs')}`
    .cwd(ROOT)
    .env({ ...process.env, NODE_ENV: 'production' })
  writeFileSync(
    join(API_FUNC, '.vc-config.json'),
    JSON.stringify(
      {
        runtime: 'nodejs22.x',
        handler: 'index.mjs',
        launcherType: 'Nodejs',
        shouldAddHelpers: false,
        supportsResponseStreaming: true,
        maxDuration: 60,
      },
      null,
      2,
    ),
  )
  writeFileSync(join(API_FUNC, 'package.json'), JSON.stringify({ type: 'module' }))
}

async function main() {
  if (!process.env.SKIP_DB) await migrateAndSeed()

  console.info('[vercel] building the web app')
  rmSync(OUTPUT, { recursive: true, force: true })
  await $`bun one build --platform=web`
    .cwd(ROOT)
    .env({ ...process.env, ONE_DEPLOY_TARGET: 'vercel' })
  if (!existsSync(join(OUTPUT, 'config.json')))
    throw new Error('one did not emit .vercel/output')

  console.info('[vercel] replacing per-route functions with one api function')
  rmSync(FUNCTIONS, { recursive: true, force: true })
  await buildApiFunction()

  const config = JSON.parse(readFileSync(join(OUTPUT, 'config.json'), 'utf8')) as {
    version: number
    routes?: Route[]
  }
  const routes = rewriteRoutes(config.routes ?? [])
  writeFileSync(
    join(OUTPUT, 'config.json'),
    JSON.stringify({ version: 3, routes, overrides: htmlOverrides() }, null, 2),
  )
  console.info(`[vercel] output ready: ${routes.length} routes, api function at /api`)
}

await main()
