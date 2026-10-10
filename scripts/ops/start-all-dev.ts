#!/usr/bin/env bun

import { cmd } from '@mtd/cli'

await cmd`Start backend and frontend in dev mode for quick integration testing`.run(
  async ({ run }) => {
    const { ports } = await import('~/env')
    const { getTestEnv } = await import('@mtd/scripts/helpers/get-test-env')
    const { handleProcessExit } = await import('@mtd/run/helpers/handleProcessExit')
    const { waitForPort } = await import('@mtd/scripts/helpers/wait-for-port')

    handleProcessExit()

    const testEnv = await getTestEnv()

    // start backend in background
    void run(`bun ops run-backend`, {
      detached: true,
      env: testEnv,
    })

    // wait for postgres to be ready
    console.info('Waiting for backend services...')
    await waitForPort(ports.postgres)

    // start frontend in dev mode
    await run(`bun ops run-frontend --dev`, {
      env: testEnv,
    })
  },
)
