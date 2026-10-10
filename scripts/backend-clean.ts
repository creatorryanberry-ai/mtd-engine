#!/usr/bin/env bun

/**
 * @description Stop local backend containers and wipe volumes
 */

import { cmd } from '@mtd/cli'
import { ensureDockerDaemon } from '@mtd/scripts/helpers/ensure-docker'

const extra = process.argv.slice(2)

await cmd`Clean local backend`.run(async ({ $ }) => {
  await ensureDockerDaemon()
  await $`docker compose down --volumes --remove-orphans --rmi local ${extra}`
})
