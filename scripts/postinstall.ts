#!/usr/bin/env bun

import { cmd } from '@mtd/cli'

await cmd`npm postinstall tasks`.run(async ({ $ }) => {
  // "tko" wont work until this runs so referencing it directly:
  const buildInitialLocation = require.resolve('@mtd/scripts/build-initial')
  await $`bun run ${buildInitialLocation}`

  await Promise.all([
    $`bun tko run env-update`,
    $`bun run one patch`,
    // regenerate claude code skills from docs (skills dir is gitignored)
    $`bun tko skills generate`,
  ])

  await $`git config --local core.hooksPath .githooks`.nothrow()
})
