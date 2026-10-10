import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SPLASH_SOURCE = 'assets/splash-logo-square.png'
const SPLASH_NAME = 'splashscreen_logo.png'
const DENSITY_DIRS = [
  'drawable-mdpi',
  'drawable-hdpi',
  'drawable-xhdpi',
  'drawable-xxhdpi',
  'drawable-xxxhdpi',
] as const

export function androidSplashLogoPath(cwd: string, densityDir: string) {
  return join(cwd, 'android/app/src/main/res', densityDir, SPLASH_NAME)
}

export function missingAndroidSplashLogos(cwd: string) {
  return DENSITY_DIRS.filter((dir) => {
    const path = androidSplashLogoPath(cwd, dir)
    return !existsSync(path) || statSync(path).size < 32
  })
}

/** expo-splash-screen writes @drawable/splashscreen_logo; sharp is stubbed so copy the square asset */
export function ensureAndroidSplashLogos(cwd: string) {
  const source = join(cwd, SPLASH_SOURCE)
  if (!existsSync(source)) {
    throw new Error(`missing ${SPLASH_SOURCE} — required for android splash logos`)
  }
  for (const dir of DENSITY_DIRS) {
    const destDir = join(cwd, 'android/app/src/main/res', dir)
    mkdirSync(destDir, { recursive: true })
    copyFileSync(source, androidSplashLogoPath(cwd, dir))
  }
}

export function assertAndroidSplashLogos(cwd: string) {
  const missing = missingAndroidSplashLogos(cwd)
  if (missing.length === 0) return
  throw new Error(
    `android splash logos missing in ${missing.join(', ')}. ` +
      're-run without --skip-prebuild, or check assets/splash-logo-square.png.',
  )
}
