#!/usr/bin/env bun

/**
 * @description Start local postgres + minio and run migrations
 */

import { cmd } from '@mtd/cli'
import { ensureDockerDaemon } from '@mtd/scripts/helpers/ensure-docker'

const extra = process.argv.slice(2)

await cmd`Start local backend`.run(async ({ $ }) => {
  await ensureDockerDaemon()
  await $`docker compose up -d pgdb minio minio-init --remove-orphans --wait ${extra}`
  await $`bun backend:migrate`
})
