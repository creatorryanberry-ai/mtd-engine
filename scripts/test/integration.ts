#!/usr/bin/env bun

// @description Run integration tests only (backend, frontend, playwright)

import { cmd } from '@mtd/cli'

await cmd`Run integration tests`.run(async ({ run }) => {
  const { time } = await import('@mtd/helpers')

  // drive the system-installed chrome (present on GitHub runners and dev
  // machines) instead of playwright's bundled chromium — the bundled install
  // reliably hangs during extraction after download on both macOS and CI.
  // override with PLAYWRIGHT_CHANNEL='' to force the bundled chromium.
  const channel = process.env.PLAYWRIGHT_CHANNEL ?? 'chrome'

  await run('bun scripts/test/e2e.ts --integration --dev --skip-checks --skip-unit', {
    timeout: time.ms.minutes(20),
    env: channel ? { PLAYWRIGHT_CHANNEL: channel } : {},
  })
})
