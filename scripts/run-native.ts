#!/usr/bin/env bun

/**
 * Launch iOS/Android against the One (`one:dev`) packager on VITE_PORT_WEB.
 *
 * Do NOT pass `--port` to Expo: that starts Expo's own Metro, which lacks One's
 * babel plugin and breaks with:
 *   Invalid call … process.env.ONE_ROUTER_APP_ROOT_RELATIVE_TO_ENTRY
 *
 * `expo run:ios --no-bundler` still opens port 8081 first. Dev/Preview share
 * the `straightuptax` scheme, so `openurl` can land in the wrong app — and that
 * app may auto-load the last packager (e.g. another project on :8081).
 * After install we launch the variant's bundle id with `--initialUrl`.
 */

import { chmodSync, existsSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { join } from 'node:path'

import { cmd } from '@mtd/cli'
import {
  androidPackageId,
  clearAndroidAutolinkingCache,
  ensurePluginManagementRepositories,
  hasStaleIosLiveActivityTargets,
  iosBundleId,
  isAndroidProjectReady,
  readAndroidNamespace,
  readIosProjectBundleId,
  removeStaleAndroidVariantSources,
} from './release/helpers/android-autolinking'
import { ensureAndroidSplashLogos } from './release/helpers/android-splash'

const platform = process.argv[2]
if (platform !== 'ios' && platform !== 'android') {
  console.error('usage: bun ./scripts/run-native.ts <ios|android> [...expo args]')
  process.exit(1)
}

const rest = process.argv.slice(3)

const variant = process.env.APP_VARIANT
if (variant !== 'preview' && variant !== 'production') {
  throw new Error(
    `APP_VARIANT must be preview or production (got ${variant ? `'${variant}'` : 'unset'}). Native builds use tax.straightup.preview or tax.straightup.app — there is no .dev identity. Example: APP_VARIANT=preview bun ios`,
  )
}

function lanIp(): string {
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        return entry.address
      }
    }
  }
  return '127.0.0.1'
}

function packagerDeepLink(port: number): string {
  const url = `http://${lanIp()}:${port}`
  return `exp+straightuptax://expo-development-client/?url=${encodeURIComponent(url)}`
}

await cmd`Run native app against One dev server`.run(async ({ $ }) => {
  const { ports } = await import('~/env')
  const port = ports.web
  const deepLink = packagerDeepLink(port)

  // verify one:dev is the packager (not Expo Metro)
  try {
    const status = await fetch(`http://127.0.0.1:${port}/status`).then((r) => r.text())
    if (!status.includes('packager-status:running')) {
      console.warn(
        `› warning: nothing healthy on :${port} — start \`bun dev\` first so one:dev is the packager`,
      )
    }
  } catch {
    console.warn(
      `› warning: cannot reach :${port} — start \`bun dev\` first so one:dev is the packager`,
    )
  }

  const nativeEnv = {
    ...process.env,
    APP_VARIANT: variant,
  }

  const cwd = process.cwd()

  if (platform === 'ios') {
    const keepBundle = iosBundleId(nativeEnv.APP_VARIANT)
    const currentBundle = readIosProjectBundleId(cwd)
    const staleWidgets = hasStaleIosLiveActivityTargets(cwd, nativeEnv.APP_VARIANT)
    if ((currentBundle && currentBundle !== keepBundle) || staleWidgets) {
      if (staleWidgets) {
        console.info(
          '› clean ios/ (stale Live Activity targets from another APP_VARIANT)',
        )
      } else {
        console.info(`› ios project is ${currentBundle}; prebuilding ${keepBundle}`)
      }
      await $`rm -rf ios`
      await $`bun native:prebuild --platform ios --no-install`.env(nativeEnv)
    }
  }

  if (platform === 'android') {
    const keepPackage = androidPackageId(nativeEnv.APP_VARIANT)
    const namespace = readAndroidNamespace(cwd)
    const needsPrebuild = !isAndroidProjectReady(cwd) || namespace !== keepPackage
    if (needsPrebuild) {
      if (!isAndroidProjectReady(cwd)) {
        console.info('› android project is incomplete; prebuilding')
      } else {
        console.info(`› android package is ${namespace}; prebuilding ${keepPackage}`)
      }
      await $`bun native:prebuild --platform android --no-install`.env({
        ...nativeEnv,
        EXPO_IMAGE_UTILS_NO_SHARP: '1',
      })
      ensurePluginManagementRepositories(cwd)
    }
    if (isAndroidProjectReady(cwd)) {
      ensureAndroidSplashLogos(cwd)
    }
    removeStaleAndroidVariantSources(cwd, keepPackage)
    clearAndroidAutolinkingCache(cwd)
    const gradlew = join(cwd, 'android/gradlew')
    if (existsSync(gradlew)) {
      chmodSync(gradlew, 0o755)
    }
    await $`adb reverse tcp:${port} tcp:${port}`.nothrow()
  }

  console.info(`› expo run:${platform} --no-bundler`)
  await $`bunx expo run:${platform} --no-bundler ${rest}`.env(nativeEnv)

  console.info(`› reopen packager at :${port}`)
  console.info(`  ${deepLink}`)

  if (platform === 'ios') {
    const packagerUrl = `http://${lanIp()}:${port}`
    const bundleId = iosBundleId(nativeEnv.APP_VARIANT)
    console.info(`› launch ${bundleId} --initialUrl ${packagerUrl}`)
    await $`xcrun simctl launch --terminate-running-process booted ${bundleId} --initialUrl ${packagerUrl}`.nothrow()
  } else {
    await $`adb reverse tcp:${port} tcp:${port}`.nothrow()
    await $`adb shell am start -a android.intent.action.VIEW -d ${deepLink}`.nothrow()
  }
})
