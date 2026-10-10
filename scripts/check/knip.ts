#!/usr/bin/env bun

import { cmd } from '@mtd/cli'

await cmd`Run knip to find unused dependencies and exports`.run(async ({ $ }) => {
  await $`bunx knip`.nothrow()
})
