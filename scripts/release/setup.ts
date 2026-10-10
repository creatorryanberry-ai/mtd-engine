#!/usr/bin/env bun

import { cmd } from '@mtd/cli'

await cmd`Setup iOS + Android secrets for local Fastlane store releases`
  .args('--ios boolean --android boolean')
  .run(async ({ args, $, colors }) => {
    const doIos = args.ios || (!args.ios && !args.android)
    const doAndroid = args.android || (!args.ios && !args.android)

    console.info()
    console.info(colors.bold('release setup'))
    console.info(colors.gray('  local Fastlane — GitHub native-cd deferred'))
    console.info()

    if (doIos) {
      console.info(colors.cyan('→ bun tko ios setup-release'))
      await $`bun tko ios setup-release`
    }
    if (doAndroid) {
      console.info(colors.cyan('→ bun tko android setup-release'))
      await $`bun tko android setup-release`
    }

    console.info()
    console.info(colors.green('setup finished'))
    console.info(colors.gray('  next: bundle install'))
    console.info(colors.gray('  then: bun tko release preview --skip-upload --skip-api'))
  })
