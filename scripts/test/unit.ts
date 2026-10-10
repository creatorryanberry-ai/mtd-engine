#!/usr/bin/env bun

// @description Run unit tests only

import { cmd } from '@mtd/cli'

await cmd`Run unit tests`.run(async ({ $ }) => {
  await $`bun run test:unit`
})
