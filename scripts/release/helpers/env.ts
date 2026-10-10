#!/usr/bin/env bun

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

export type AppVariant = 'preview' | 'production'

export const BUNDLE_IDS = {
  preview: {
    ios: 'tax.straightup.preview',
    android: 'tax.straightup.preview',
  },
  production: {
    ios: 'tax.straightup.app',
    android: 'tax.straightup.app',
  },
} as const

/** parse KEY=value env file (supports multiline quoted values) */
export function loadEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) {
    return {}
  }

  const content = readFileSync(filePath, 'utf-8')
  const secrets: Record<string, string> = {}
  const lines = content.split('\n')
  let currentKey: string | null = null
  let currentValue: string[] = []
  let inMultiline = false

  const saveCurrentKey = () => {
    if (currentKey) {
      let value = currentValue.join('\n')
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      value = value.replace(/\\"/g, '"')
      secrets[currentKey] = value
    }
    currentKey = null
    currentValue = []
    inMultiline = false
  }

  for (const line of lines) {
    if (inMultiline) {
      currentValue.push(line)
      if (line.includes('-----END') && line.includes('KEY-----')) {
        const trimmed = line.trim()
        if (trimmed.endsWith('"') || trimmed.endsWith("'")) {
          saveCurrentKey()
        }
      } else if (line.trim().endsWith('"') || line.trim().endsWith("'")) {
        saveCurrentKey()
      }
      continue
    }

    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (match?.[1]) {
      if (currentKey) saveCurrentKey()
      currentKey = match[1]
      const valueStart = match[2] || ''
      if (
        (valueStart.startsWith('"') && !valueStart.endsWith('"')) ||
        (valueStart.startsWith("'") && !valueStart.endsWith("'"))
      ) {
        inMultiline = true
        currentValue = [valueStart]
      } else {
        currentValue = [valueStart]
        saveCurrentKey()
      }
    }
  }
  if (currentKey) saveCurrentKey()

  return secrets
}

export function applyEnv(vars: Record<string, string>) {
  for (const [key, value] of Object.entries(vars)) {
    if (value !== undefined && value !== '') {
      process.env[key] = value
    }
  }
}

export function discoverIosProject(repoRoot: string): {
  workspace: string
  scheme: string
  extensionBundleId: string | null
} {
  const iosDir = join(repoRoot, 'ios')
  if (!existsSync(iosDir)) {
    throw new Error('ios/ not found — run prebuild first')
  }

  const workspaces = readdirSync(iosDir).filter(
    (f) => f.endsWith('.xcworkspace') && !f.includes('xcodeproj'),
  )
  if (workspaces.length === 0) {
    throw new Error('no .xcworkspace found in ios/')
  }

  const workspaceName = workspaces[0]!
  const scheme = workspaceName.replace(/\.xcworkspace$/, '')
  const workspace = join(iosDir, workspaceName)

  // live activity extension: <bundleId>.<Scheme>LiveActivity
  let extensionBundleId: string | null = null
  const pbx = join(iosDir, `${scheme}.xcodeproj`, 'project.pbxproj')
  if (existsSync(pbx)) {
    const content = readFileSync(pbx, 'utf-8')
    const extMatch = content.match(
      /PRODUCT_BUNDLE_IDENTIFIER = "?([a-z0-9.]+LiveActivity)"?;/i,
    )
    if (extMatch?.[1]) {
      extensionBundleId = extMatch[1]
    }
  }

  return { workspace, scheme, extensionBundleId }
}

export function resolveKeystorePath(
  repoRoot: string,
  env: Record<string, string>,
): string | undefined {
  const pathVal = env.ANDROID_KEYSTORE_PATH || process.env.ANDROID_KEYSTORE_PATH
  if (pathVal) {
    return resolve(repoRoot, pathVal)
  }
  return undefined
}

/**
 * resolve the deployed server + api urls to bake into the native bundle.
 * the native app derives SERVER_URL from ONE_SERVER_URL and API_BASE_URL from
 * API_SERVER_URL/VITE_API_HOSTNAME (injected via vxrn's native prelude). without
 * these the bundle falls back to http://localhost:8081 (unreachable on device ->
 * "Network request failed").
 *
 * source of truth is ONLY the variant's env file:
 *   preview    → .env.staging
 *   production → .env.production
 * ambient process.env (bun auto-loads .env.development) is ignored so local
 * localhost values cannot pollute a release bundle.
 */
export function resolveBundleServerEnv(
  cwd: string,
  variant: AppVariant = 'production',
): {
  serverUrl: string
  webHostname: string
  webProtocol: string
  apiServerUrl: string
  apiHostname: string
  bundleEnv: Record<string, string>
  envFile: string
} {
  const envFile = variant === 'preview' ? '.env.staging' : '.env.production'
  const envPath = join(cwd, envFile)
  if (!existsSync(envPath)) {
    throw new Error(
      `${variant} release requires ${envFile} (not found). ` +
        (variant === 'preview'
          ? 'copy .env.staging.example → .env.staging and fill staging urls.'
          : 'copy .env.production.example → .env.production and fill production urls.'),
    )
  }

  const fileEnv = loadEnvFile(envPath)

  const apiServerUrl = fileEnv.API_SERVER_URL || ''
  const apiHostname =
    fileEnv.VITE_API_HOSTNAME || apiServerUrl.replace(/^https?:\/\//, '')

  // api-only deploys omit web urls; mirror the api host so native code that still
  // reads ONE_SERVER_URL / VITE_WEB_HOSTNAME (authFetch, EventSource, etc.) works.
  const serverUrl =
    fileEnv.ONE_SERVER_URL ||
    apiServerUrl ||
    (apiHostname ? `https://${apiHostname}` : '')
  const webHostname =
    fileEnv.VITE_WEB_HOSTNAME || serverUrl.replace(/^https?:\/\//, '') || apiHostname
  const webProtocol = fileEnv.VITE_PROTOCOL || 'https'

  // refuse to ship a release that resolved nothing from its own env file.
  if (!serverUrl && !apiServerUrl && !apiHostname) {
    throw new Error(
      `${variant} release has no urls in ${envFile}: set API_SERVER_URL / ` +
        `VITE_API_HOSTNAME (or ONE_SERVER_URL). refusing to use another env file.`,
    )
  }

  const bundleEnv: Record<string, string> = {}
  if (serverUrl) bundleEnv.ONE_SERVER_URL = serverUrl
  if (webHostname) {
    bundleEnv.VITE_WEB_HOSTNAME = webHostname
    bundleEnv.VITE_PROTOCOL = webProtocol
  }
  if (apiServerUrl) bundleEnv.API_SERVER_URL = apiServerUrl
  if (apiHostname) {
    bundleEnv.VITE_API_HOSTNAME = apiHostname
    bundleEnv.VITE_PROTOCOL = webProtocol
  }
  // auth UI flags — bake from the variant file so preview can show demo/login
  // while production ships with them off (empty → omitted → false at runtime).
  for (const key of BUNDLE_AUTH_KEYS) {
    const value = fileEnv[key]
    if (value) bundleEnv[key] = value
  }

  return {
    serverUrl,
    webHostname,
    webProtocol,
    apiServerUrl,
    apiHostname,
    bundleEnv,
    envFile,
  }
}

/** url keys we bake into the native js bundle — scrub ambient copies before apply */
export const BUNDLE_URL_KEYS = [
  'ONE_SERVER_URL',
  'VITE_WEB_HOSTNAME',
  'VITE_PROTOCOL',
  'API_SERVER_URL',
  'VITE_API_HOSTNAME',
] as const

/** client auth gates baked alongside urls (preview enables; production usually omits) */
export const BUNDLE_AUTH_KEYS = ['VITE_ALLOW_PUBLIC_AUTH', 'VITE_DEMO_MODE'] as const

/**
 * clear ambient url/auth keys (e.g. from bun loading .env.development) then apply
 * the variant's resolved bundle env so process.env matches the release target only.
 */
export function applyBundleEnv(bundleEnv: Record<string, string>) {
  for (const key of [...BUNDLE_URL_KEYS, ...BUNDLE_AUTH_KEYS]) {
    delete process.env[key]
  }
  applyEnv(bundleEnv)
}

/**
 * bake urls into ios/.xcode.env.local for xcode's sandboxed "Bundle React Native
 * code" phase (does not inherit the release runner's process.env). this is an
 * ios build artifact under ios/ (gitignored) — not a fourth app env file.
 * android gets the same urls via process.env on the gradle/fastlane invocation
 * (see run-release + --no-daemon so the daemon cannot retain stale env).
 */
export function writeXcodeEnvLocal(
  iosDir: string,
  bundleEnv: Record<string, string>,
): void {
  if (Object.keys(bundleEnv).length === 0) return
  const lines = [
    '# generated by scripts/release — do not edit or commit.',
    '# baked into the native js bundle (vxrn sources this in the RN bundle phase).',
    ...Object.entries(bundleEnv).map(
      ([key, val]) => `export ${key}=${JSON.stringify(val)}`,
    ),
    '',
  ]
  writeFileSync(join(iosDir, '.xcode.env.local'), lines.join('\n'))
}

export function resolvePlayJsonPath(
  repoRoot: string,
  env: Record<string, string>,
): string | undefined {
  const pathVal =
    env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH ||
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH
  if (pathVal) {
    return resolve(repoRoot, pathVal)
  }
  return undefined
}

/** mac/linux default SDK locations when ANDROID_HOME is unset */
function defaultAndroidSdkCandidates(): string[] {
  const home = process.env.HOME || ''
  return [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    home ? join(home, 'Library/Android/sdk') : '',
    home ? join(home, 'Android/Sdk') : '',
  ].filter(Boolean) as string[]
}

/** resolve a usable Android SDK root or throw with setup hints */
export function resolveAndroidSdkPath(): string {
  for (const candidate of defaultAndroidSdkCandidates()) {
    if (candidate && existsSync(candidate)) {
      return candidate
    }
  }
  throw new Error(
    'Android SDK not found. Install Android Studio SDK tools, then either:\n' +
      '  export ANDROID_HOME="$HOME/Library/Android/sdk"\n' +
      'or set ANDROID_HOME in .env.android',
  )
}

/**
 * write android/local.properties with sdk.dir (required by gradle when
 * ANDROID_HOME is not exported). android/ is wiped by prebuild, so call this
 * after prebuild / before gradlew.
 */
export function writeAndroidLocalProperties(repoRoot: string, sdkPath?: string): string {
  const sdk = sdkPath || resolveAndroidSdkPath()
  const androidDir = join(repoRoot, 'android')
  if (!existsSync(androidDir)) {
    throw new Error('android/ not found — run prebuild first')
  }
  // gradle local.properties: escape backslashes for windows paths
  const escaped = sdk.replace(/\\/g, '\\\\')
  writeFileSync(
    join(androidDir, 'local.properties'),
    `# generated by scripts/release — do not commit.\nsdk.dir=${escaped}\n`,
  )
  return sdk
}
