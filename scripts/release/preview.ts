#!/usr/bin/env bun

import { cmd } from '@mtd/cli'

import { runRelease } from './helpers/run-release'

await cmd`Build and upload preview apps (TestFlight + Play internal)`
  .args(
    '--ios boolean --android boolean --web boolean --skip-upload boolean --skip-prebuild boolean --skip-api boolean',
  )
  .run(async ({ args, $, colors }) => {
    await runRelease(
      {
        variant: 'preview',
        ios: !!args.ios,
        android: !!args.android,
        web: !!args.web,
        skipUpload: !!args.skipUpload,
        skipPrebuild: !!args.skipPrebuild,
        skipApi: !!args.skipApi,
      },
      { $, colors, cwd: process.cwd() },
    )
  })
