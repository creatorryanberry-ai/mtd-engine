#!/usr/bin/env bun

import { plugin } from 'bun'

import { cmd } from '@mtd/cli'

// server modules import 'server-only', which throws outside a react-server bundle.
// this script is server code, so stub the guard before the dynamic imports below.
plugin({
  name: 'stub-server-only',
  setup(build) {
    build.module('server-only', () => ({ exports: {}, loader: 'object' }))
    build.onResolve({ filter: /^server-only$/ }, () => ({ path: 'server-only' }))
  },
})

/**
 * seeds a synthetic business ("northstar roofing") into the engine for demos
 * and tests. idempotent: re-running updates in place. run with
 * `bun run:dev scripts/db/seed-engine.ts [--email demo@straightup.tax]`.
 */
await cmd`Seed the growth engine with a synthetic business`
  .args('--email string --seed number')
  .run(async ({ args }) => {
    const { seedEngineDemo } =
      await import('~/features/engine/seed/server/seedEngineDemo')
    await seedEngineDemo({
      email: args.email as string | undefined,
      seed: args.seed as number | undefined,
    })
    process.exit(0)
  })
