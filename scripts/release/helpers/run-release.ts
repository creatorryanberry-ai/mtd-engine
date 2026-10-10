#!/usr/bin/env bun

import { existsSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import {
  assertAndroidProjectReady,
  clearAndroidAutolinkingCache,
  ensurePluginManagementRepositories,
} from './android-autolinking'
import { assertAndroidSplashLogos, ensureAndroidSplashLogos } from './android-splash'
import {
  type AppVariant,
  BUNDLE_IDS,
  applyBundleEnv,
  applyEnv,
  discoverIosProject,
  loadEnvFile,
  resolveBundleServerEnv,
  resolveKeystorePath,
  resolvePlayJsonPath,
  writeAndroidLocalProperties,
  writeXcodeEnvLocal,
} from './env'
import { uploadAabToPlay } from './play-upload'
import { gymLogHint, summarizeFastlaneFailure } from './fastlane-output'
import { resolvePodInstall, resolveRubyEnv } from './ruby'

export type ReleaseOptions = {
  variant: AppVariant
  ios: boolean
  android: boolean
  web: boolean
  skipUpload: boolean
  skipPrebuild: boolean
  /** skip uncloud api deploy (default: api ships before native/web builds) */
  skipApi: boolean
}

async function runFastlane(
  $: typeof import('bun').$,
  colors: { cyan: (s: string) => string; gray: (s: string) => string },
  opts: {
    cwd: string
    bundleBin: string
    gemfile: string
    env: Record<string, string>
    args: string[]
    label: string
    scheme?: string
  },
) {
  console.info(colors.cyan(`→ ${opts.label}`))
  const result = await $`${opts.bundleBin} exec fastlane ${opts.args}`
    .cwd(opts.cwd)
    .env({
      ...opts.env,
      BUNDLE_GEMFILE: opts.gemfile,
    })
    .nothrow()

  if (result.exitCode === 0) return

  const combined = `${result.stdout}\n${result.stderr}`
  const summary = summarizeFastlaneFailure(combined)
  const hint = gymLogHint(opts.scheme)
  console.error(colors.gray(hint))
  if (summary) console.error(summary)
  throw new Error(`${opts.label} failed (exit ${result.exitCode}). ${hint}`)
}

export async function runRelease(
  opts: ReleaseOptions,
  ctx: {
    $: typeof import('bun').$
    colors: {
      bold: (s: string) => string
      gray: (s: string) => string
      cyan: (s: string) => string
      green: (s: string) => string
    }
    cwd: string
  },
) {
  const { $, colors, cwd } = ctx
  const { variant, skipUpload, skipPrebuild, skipApi } = opts
  let { ios, android, web } = opts

  if (!ios && !android && !web) {
    ios = true
    android = true
    // when shipping the web app, uncomment the next line so plain release includes web
    // web = true
  }

  const iosEnv = loadEnvFile(join(cwd, '.env.ios'))
  const androidEnv = loadEnvFile(join(cwd, '.env.android'))
  applyEnv(iosEnv)
  applyEnv(androidEnv)

  // bake urls from the variant's env file ONLY (.env.staging | .env.production).
  const {
    serverUrl,
    webHostname,
    webProtocol,
    apiServerUrl,
    apiHostname,
    bundleEnv,
    envFile,
  } = resolveBundleServerEnv(cwd, variant)
  applyBundleEnv(bundleEnv)

  // allow P8 via file path (interactive paste often truncates multiline keys)
  const p8Path =
    process.env.APP_STORE_CONNECT_API_KEY_P8_PATH ||
    iosEnv.APP_STORE_CONNECT_API_KEY_P8_PATH
  if (p8Path) {
    const resolved = resolve(cwd, p8Path)
    if (!existsSync(resolved)) {
      throw new Error(`APP_STORE_CONNECT_API_KEY_P8_PATH not found: ${resolved}`)
    }
    process.env.APP_STORE_CONNECT_API_KEY_P8 = readFileSync(resolved, 'utf-8').trim()
  }

  // fastlane match reads MATCH_PASSWORD
  if (process.env.APPLE_CODE_SIGNING_GIT_PASSPHRASE && !process.env.MATCH_PASSWORD) {
    process.env.MATCH_PASSWORD = process.env.APPLE_CODE_SIGNING_GIT_PASSPHRASE
  }

  const bundle = BUNDLE_IDS[variant]
  const iosBundleId =
    (variant === 'preview'
      ? iosEnv.IOS_BUNDLE_ID_PREVIEW
      : iosEnv.IOS_BUNDLE_ID_PRODUCTION) || bundle.ios
  const androidPackage =
    (variant === 'preview'
      ? androidEnv.ANDROID_PACKAGE_PREVIEW
      : androidEnv.ANDROID_PACKAGE_PRODUCTION) || bundle.android

  // repo-root `fastlane` symlink → src/fastlane
  const gemfile = join(cwd, 'Gemfile')
  const playJsonPath = resolvePlayJsonPath(cwd, androidEnv)
  // prefer .ruby-version (chruby) over system ruby 2.6 for bundle/fastlane
  const { env: rubyEnv, bundle: bundleBin } = resolveRubyEnv(cwd)

  // build numbers: each store's latest + 1, per platform (independent
  // sequences). stores silently drop duplicate build numbers, and a failed
  // build/upload changes nothing in the store — the next run re-queries and
  // lands on the same number. a failed QUERY aborts; we never guess.
  // manual override: IOS_BUILD_NUMBER / ANDROID_VERSION_CODE.
  const queryStoreNumber = async (
    platform: 'ios' | 'android',
    lane: string,
    env: Record<string, string>,
  ): Promise<string> => {
    const file = join(tmpdir(), `mtd-next-build-${platform}-${Date.now()}.txt`)
    try {
      await runFastlane($, colors, {
        cwd,
        bundleBin,
        gemfile,
        env: {
          ...rubyEnv,
          BUILD_NUMBER_FILE: file,
          ...env,
        },
        args: [platform, lane],
        label: `fastlane ${platform} ${lane} (query store)`,
      })
      const value = existsSync(file) ? readFileSync(file, 'utf-8').trim() : ''
      if (!/^\d+$/.test(value)) {
        throw new Error(`fastlane ${platform} ${lane} wrote no build number`)
      }
      return value
    } finally {
      rmSync(file, { force: true })
    }
  }

  if (ios && !process.env.IOS_BUILD_NUMBER) {
    process.env.IOS_BUILD_NUMBER = await queryStoreNumber('ios', 'next_build_number', {
      IOS_BUNDLE_ID: iosBundleId,
    })
  }
  if (android && !process.env.ANDROID_VERSION_CODE) {
    process.env.ANDROID_VERSION_CODE = await queryStoreNumber(
      'android',
      'next_version_code',
      {
        ANDROID_PACKAGE_NAME: androidPackage,
        ...(playJsonPath ? { GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH: playJsonPath } : {}),
      },
    )
  }

  console.info()
  console.info(colors.bold(`release ${variant}`))
  console.info(
    colors.gray(
      `  ios: ${ios}  android: ${android}  web: ${web}  skip-upload: ${skipUpload}  skip-api: ${skipApi}`,
    ),
  )
  console.info(colors.gray(`  ios bundle: ${iosBundleId}`))
  console.info(colors.gray(`  android package: ${androidPackage}`))
  if (ios) {
    console.info(colors.gray(`  ios build number: ${process.env.IOS_BUILD_NUMBER}`))
  }
  if (android) {
    console.info(
      colors.gray(`  android version code: ${process.env.ANDROID_VERSION_CODE}`),
    )
  }
  if (serverUrl || webHostname) {
    const displayUrl = serverUrl || `${webProtocol}://${webHostname}`
    console.info(colors.gray(`  env file: ${envFile}`))
    console.info(colors.gray(`  server url: ${displayUrl}`))
    const displayApi =
      apiServerUrl || (apiHostname ? `${webProtocol}://${apiHostname}` : '')
    if (displayApi) console.info(colors.gray(`  api url: ${displayApi}`))
  } else {
    console.info(colors.bold(`  ⚠ no urls in ${envFile} —`))
    console.info(
      colors.bold(
        '    bundle will fall back to http://localhost:8081 (broken on device)',
      ),
    )
  }
  console.info()

  // ship api before native/web so preview/prod clients never hit a stale backend
  if (skipApi) {
    console.info(colors.cyan('→ api deploy skipped (--skip-api)'))
  } else {
    const staging = variant === 'preview'
    const apiFlag = staging ? '--staging' : '--production'
    console.info(colors.cyan(`→ uncloud deploy-api ${apiFlag} (${variant})`))
    if (staging) {
      await $`bun tko uncloud deploy-api --staging`.cwd(cwd).env(process.env)
    } else {
      await $`bun tko uncloud deploy-api --production`.cwd(cwd).env(process.env)
    }
  }

  if (!skipPrebuild) {
    if (ios) {
      const iosDir = join(cwd, 'ios')
      if (existsSync(iosDir)) {
        console.info(colors.cyan('→ clean ios/ (avoid mixed APP_VARIANT projects)'))
        await $`rm -rf ${iosDir}`
      }
      console.info(colors.cyan('→ prebuild ios'))
      await $`bun native:prebuild --platform ios --no-install`.env({
        ...process.env,
        APP_VARIANT: variant,
      })
      if (existsSync(join(cwd, 'ios', 'Podfile'))) {
        console.info(colors.cyan('→ pod install'))
        // chruby user-gem cocoapods — must keep GEM_HOME (unlike bundle/fastlane)
        const { pod: podBin, env: podEnv } = resolvePodInstall(cwd)
        console.info(colors.gray(`  using ${podBin}`))
        await $`${podBin} install`.cwd(join(cwd, 'ios')).env(podEnv)
      }
    }
    if (android) {
      const androidDir = join(cwd, 'android')
      if (existsSync(androidDir)) {
        console.info(colors.cyan('→ clean android/ (avoid mixed APP_VARIANT projects)'))
        await $`rm -rf ${androidDir}`
      }
      console.info(colors.cyan('→ prebuild android'))
      await $`bun native:prebuild --platform android --no-install`.env({
        ...process.env,
        APP_VARIANT: variant,
        // sharp is stubbed (tamagui proxy-worm); force jimp so expo can still resize
        EXPO_IMAGE_UTILS_NO_SHARP: '1',
      })
      ensurePluginManagementRepositories(cwd)
      ensureAndroidSplashLogos(cwd)
    }
  }

  const playTrack = variant === 'preview' ? 'internal' : 'production'
  const playReleaseStatus = variant === 'production' ? 'draft' : 'completed'

  if (android && !/^\d+$/.test(process.env.ANDROID_VERSION_CODE || '')) {
    throw new Error('ANDROID_VERSION_CODE missing after store query')
  }
  if (ios && !/^\d+$/.test(process.env.IOS_BUILD_NUMBER || '')) {
    throw new Error('IOS_BUILD_NUMBER missing after store query')
  }

  const commonEnv: Record<string, string> = {
    ...rubyEnv,
    APP_VARIANT: variant,
    REPO_ROOT: cwd,
    SKIP_UPLOAD: skipUpload ? '1' : '0',
    IOS_BUNDLE_ID: iosBundleId,
    ANDROID_PACKAGE_NAME: androidPackage,
    PLAY_TRACK: playTrack,
    PLAY_RELEASE_STATUS: playReleaseStatus,
    ANDROID_PROJECT_DIR: join(cwd, 'android'),
    MATCH_FORCE_LEGACY_ENCRYPTION: 'true',
    ...(process.env.IOS_BUILD_NUMBER
      ? { IOS_BUILD_NUMBER: process.env.IOS_BUILD_NUMBER }
      : {}),
    ...(process.env.ANDROID_VERSION_CODE
      ? { ANDROID_VERSION_CODE: process.env.ANDROID_VERSION_CODE }
      : {}),
  }
  // match rejects MATCH_FORCE as a string; only sync_certs should regenerate
  delete commonEnv.MATCH_FORCE
  delete commonEnv.REGENERATE_PROFILES

  const keystorePath = resolveKeystorePath(cwd, androidEnv)
  if (keystorePath) {
    commonEnv.ANDROID_KEYSTORE_PATH = keystorePath
  }
  if (playJsonPath) {
    commonEnv.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH = playJsonPath
  }

  if (ios) {
    const { workspace, scheme, extensionBundleId } = discoverIosProject(cwd)
    // xcode RN bundle phase is sandboxed — inject urls via ios/.xcode.env.local
    // (build artifact under ios/, not a fourth app env file).
    writeXcodeEnvLocal(join(cwd, 'ios'), bundleEnv)
    await runFastlane($, colors, {
      cwd,
      bundleBin,
      gemfile,
      env: {
        ...commonEnv,
        ...bundleEnv,
        IOS_WORKSPACE: workspace,
        IOS_SCHEME: scheme,
        ...(extensionBundleId ? { IOS_EXTENSION_BUNDLE_ID: extensionBundleId } : {}),
      },
      args: ['ios', 'beta'],
      label: `fastlane ios beta (${scheme})`,
      scheme,
    })
  }

  if (android) {
    if (!existsSync(join(cwd, 'android'))) {
      throw new Error('android/ not found — run prebuild first')
    }
    assertAndroidProjectReady(cwd)
    ensureAndroidSplashLogos(cwd)
    assertAndroidSplashLogos(cwd)
    // skip-prebuild path still needs the pluginManagement repos patch
    ensurePluginManagementRepositories(cwd)
    // prebuild wipes android/; gradle needs sdk.dir or ANDROID_HOME
    const androidSdk = writeAndroidLocalProperties(cwd)
    commonEnv.ANDROID_HOME = androidSdk
    commonEnv.ANDROID_SDK_ROOT = androidSdk
    // stop a stale gradle daemon so it cannot retain old env; the bundle step
    // inherits process.env (bundleEnv) from this fastlane invocation.
    console.info(colors.cyan('→ gradle --stop (fresh env for bundle)'))
    await $`./gradlew --stop`.cwd(join(cwd, 'android')).env(commonEnv).nothrow()
    // wipe RN autolinking cache — it does not invalidate on APP_VARIANT /
    // namespace changes and can generate BuildConfig refs for the wrong package.
    console.info(colors.cyan('→ clear android autolinking cache'))
    clearAndroidAutolinkingCache(cwd)
    await runFastlane($, colors, {
      cwd,
      bundleBin,
      gemfile,
      env: {
        ...commonEnv,
        ...bundleEnv,
        SKIP_UPLOAD: '1',
      },
      args: ['android', 'beta'],
      label: 'fastlane android beta (build only)',
    })

    if (!skipUpload) {
      if (!playJsonPath) {
        throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH not set')
      }
      const aab = join(
        cwd,
        'android',
        'app',
        'build',
        'outputs',
        'bundle',
        'release',
        'app-release.aab',
      )
      if (!existsSync(aab)) {
        throw new Error(`aab missing after build: ${aab}`)
      }
      console.info(colors.cyan('→ chunked play upload (resumable)'))
      await uploadAabToPlay({
        packageName: androidPackage,
        aabPath: aab,
        jsonKeyPath: playJsonPath,
        track: playTrack,
        releaseStatus: playReleaseStatus,
      })
    }
  }

  if (web) {
    if (skipUpload) {
      console.info(colors.cyan('→ web deploy skipped (--skip-upload)'))
    } else {
      const staging = variant === 'preview'
      console.info(
        colors.cyan(
          `→ uncloud deploy-web${staging ? ' --staging' : ' --production'} (${variant})`,
        ),
      )
      if (staging) {
        await $`bun tko uncloud deploy-web --staging`.cwd(cwd).env(process.env)
      } else {
        await $`bun tko uncloud deploy-web --production`.cwd(cwd).env(process.env)
      }
    }
  }

  console.info()
  console.info(colors.green(`✓ release ${variant} finished`))
  if (skipUpload) {
    console.info(colors.gray('  (uploads skipped)'))
  }
}
