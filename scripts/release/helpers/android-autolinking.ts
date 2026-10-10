#!/usr/bin/env bun

import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export type StoreVariant = 'preview' | 'production'

export function requireStoreVariant(
  variant = process.env.APP_VARIANT,
): StoreVariant {
  if (variant === 'preview' || variant === 'production') return variant
  const got = variant ? `'${variant}'` : 'unset'
  throw new Error(
    `APP_VARIANT must be preview or production (got ${got}). Native builds use tax.straightup.preview or tax.straightup.app — there is no .dev identity. Example: APP_VARIANT=preview bun ios`,
  )
}

export function androidPackageId(variant = process.env.APP_VARIANT) {
  const resolved = requireStoreVariant(variant)
  if (resolved === 'preview') return 'tax.straightup.preview'
  return 'tax.straightup.app'
}

export function iosBundleId(variant = process.env.APP_VARIANT) {
  return androidPackageId(variant)
}

export function readIosProjectBundleId(cwd: string): string | null {
  const iosDir = join(cwd, 'ios')
  if (!existsSync(iosDir)) return null
  const project = readdirSync(iosDir).find(
    (name) => name.endsWith('.xcodeproj') && name.startsWith('StraightUpTax'),
  )
  if (!project) return null
  const stem = project.slice(0, -'.xcodeproj'.length)
  if (stem === 'StraightUpTaxPreview') return 'tax.straightup.preview'
  if (stem === 'StraightUpTaxDev') return 'tax.straightup.dev'
  if (stem === 'StraightUpTax') return 'tax.straightup.app'
  return null
}

export function iosLiveActivityDirName(variant = process.env.APP_VARIANT) {
  const resolved = requireStoreVariant(variant)
  if (resolved === 'preview') return 'StraightUpTaxPreviewLiveActivity'
  return 'StraightUpTaxLiveActivity'
}

/** expo prebuild does not remove Live Activity targets from other APP_VARIANT runs */
export function hasStaleIosLiveActivityTargets(
  cwd: string,
  variant = process.env.APP_VARIANT,
) {
  const iosDir = join(cwd, 'ios')
  if (!existsSync(iosDir)) return false
  const keep = iosLiveActivityDirName(variant)
  return readdirSync(iosDir).some(
    (name) => name.endsWith('LiveActivity') && name !== keep,
  )
}

export function readAndroidNamespace(cwd: string): string | null {
  const gradle = join(cwd, 'android/app/build.gradle')
  if (!existsSync(gradle)) return null
  return readFileSync(gradle, 'utf-8').match(/namespace\s+'([^']+)'/)?.[1] ?? null
}

/** expo prebuild does not delete the previous APP_VARIANT java package */
export function removeStaleAndroidVariantSources(cwd: string, keepPackage: string) {
  const javaRoot = join(cwd, 'android/app/src/main/java/tax/straightup')
  if (!existsSync(javaRoot)) return
  const keepLeaf = keepPackage.split('.').at(-1)
  for (const entry of readdirSync(javaRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === keepLeaf) continue
    rmSync(join(javaRoot, entry.name), { recursive: true, force: true })
  }
}

/**
 * RN/Expo cache autolinking.json and only invalidate on lockfile changes — not
 * when APP_VARIANT / android.package changes. a stale cache can bake the wrong
 * BuildConfig package into ReactNativeApplicationEntryPoint.java
 * (e.g. a sanitized display-name fallback instead of
 * tax.straightup.preview from build.gradle).
 */
export function clearAndroidAutolinkingCache(cwd: string) {
  for (const rel of [
    'android/build/generated/autolinking',
    'android/app/build/generated/autolinking',
  ]) {
    const dir = join(cwd, rel)
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true })
    }
  }
}

export function isAndroidProjectReady(cwd: string) {
  return (
    existsSync(join(cwd, 'android/gradle/wrapper/gradle-wrapper.jar')) &&
    existsSync(join(cwd, 'android/settings.gradle')) &&
    existsSync(join(cwd, 'android/app/src/main/AndroidManifest.xml'))
  )
}

/** fail fast when --skip-prebuild leaves a half-deleted android/ tree */
export function assertAndroidProjectReady(cwd: string) {
  if (isAndroidProjectReady(cwd)) return
  throw new Error(
    'android/ is incomplete (missing gradle wrapper or AndroidManifest.xml). ' +
      're-run without --skip-prebuild so native:prebuild can recreate it.',
  )
}

/**
 * expo's generated settings.gradle includeBuilds composite plugins without
 * declaring pluginManagement repos. gradle 9 then fails resolving kotlin/agp
 * for those included builds ("no repositories are defined").
 */
export function ensurePluginManagementRepositories(cwd: string) {
  const settingsPath = join(cwd, 'android/settings.gradle')
  if (!existsSync(settingsPath)) return

  const contents = readFileSync(settingsPath, 'utf-8')
  if (!contents.includes('pluginManagement')) return
  // already patched / template already has repos inside pluginManagement
  if (/pluginManagement\s*\{[\s\S]*?repositories\s*\{/.test(contents)) {
    return
  }

  const patched = contents.replace(
    /pluginManagement\s*\{/,
    `pluginManagement {
  repositories {
    google()
    mavenCentral()
    gradlePluginPortal()
  }
`,
  )
  if (patched === contents) return
  writeFileSync(settingsPath, patched)
}
