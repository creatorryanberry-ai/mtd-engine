#!/usr/bin/env bun

import { cmd } from '@mtd/cli'
import { ensureDockerDaemon } from '@mtd/scripts/helpers/ensure-docker'

await cmd`Build docker image for web`.run(async ({ $ }) => {
  // pass all arguments directly to docker buildx build
  const args = process.argv.slice(2)

  // use DEPLOYMENT_ARCH from env, default to amd64 for broader compatibility
  const platform = process.env.DEPLOYMENT_ARCH || 'linux/amd64'
  console.info(`building docker image for ${platform}`)

  await ensureDockerDaemon()
  await $`docker buildx build --platform ${platform} ${args}`
})
