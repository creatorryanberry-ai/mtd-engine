#!/usr/bin/env bun

import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { cmd } from '@mtd/cli'

import {
  type AppVariant,
  BUNDLE_IDS,
  applyEnv,
  discoverIosProject,
  loadEnvFile,
  resolvePlayJsonPath,
} from './helpers/env'
import { uploadAabToPlay } from './helpers/play-upload'
import { resolveRubyEnv } from './helpers/ruby'

await cmd`Upload an already-built ios ipa / android aab (after --skip-upload)`
  .args('--production boolean --ios boolean --android boolean --ipa string --aab string')
  .run(async ({ args, $, colors }) => {
    const cwd = process.cwd()
    const variant: AppVariant = args.production ? 'production' : 'preview'
    let { ios, android } = args
    if (!ios && !android) {
      ios = true
    }

    const iosEnv = loadEnvFile(join(cwd, '.env.ios'))
    const androidEnv = loadEnvFile(join(cwd, '.env.android'))
    applyEnv(iosEnv)
    applyEnv(androidEnv)

    const { env: rubyEnv, bundle } = resolveRubyEnv(cwd)
    const gemfile = join(cwd, 'Gemfile')

    if (ios) {
      // same P8 path→content resolution as run-release (altool needs the key)
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

      const iosBundleId =
        (variant === 'preview'
          ? iosEnv.IOS_BUNDLE_ID_PREVIEW
          : iosEnv.IOS_BUNDLE_ID_PRODUCTION) || BUNDLE_IDS[variant].ios

      const { scheme } = discoverIosProject(cwd)

      console.info()
      console.info(colors.bold(`upload ${variant} ios (${iosBundleId})`))
      console.info(colors.cyan(`→ fastlane ios upload (${scheme})`))

      await $`${bundle} exec fastlane ios upload`.cwd(cwd).env({
        ...rubyEnv,
        REPO_ROOT: cwd,
        BUNDLE_GEMFILE: gemfile,
        IOS_SCHEME: scheme,
        IOS_BUNDLE_ID: iosBundleId,
        ...(args.ipa ? { IPA_PATH: resolve(cwd, args.ipa) } : {}),
      })
    }

    if (android) {
      const androidPackage =
        (variant === 'preview'
          ? androidEnv.ANDROID_PACKAGE_PREVIEW
          : androidEnv.ANDROID_PACKAGE_PRODUCTION) || BUNDLE_IDS[variant].android

      const playJsonPath = resolvePlayJsonPath(cwd, androidEnv)
      if (!playJsonPath) {
        throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH not set')
      }
      const aab =
        args.aab ||
        join(
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
        throw new Error(`aab not found at ${aab} — build first with bun tko release`)
      }
      const playTrack = variant === 'preview' ? 'internal' : 'production'
      const playReleaseStatus = variant === 'production' ? 'draft' : 'completed'

      console.info()
      console.info(colors.bold(`upload ${variant} android (${androidPackage})`))
      console.info(colors.cyan('→ chunked play upload (resumable)'))
      console.info(colors.gray(`  ${aab}`))

      await uploadAabToPlay({
        packageName: androidPackage,
        aabPath: resolve(cwd, aab),
        jsonKeyPath: playJsonPath,
        track: playTrack,
        releaseStatus: playReleaseStatus,
      })
    }

    console.info()
    console.info(colors.green(`✓ upload ${variant} finished`))
  })
