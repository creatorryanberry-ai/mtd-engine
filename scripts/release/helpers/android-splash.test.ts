import { mkdirSync, writeFileSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  assertAndroidSplashLogos,
  ensureAndroidSplashLogos,
  missingAndroidSplashLogos,
} from './android-splash'

function makeTree() {
  const root = mkdtempSync(join(tmpdir(), 'android-splash-'))
  mkdirSync(join(root, 'assets'), { recursive: true })
  writeFileSync(join(root, 'assets/splash-logo-square.png'), Buffer.alloc(64, 1))
  return root
}

describe('android splash logos', () => {
  it('copies the square asset into every density folder', () => {
    const root = makeTree()
    expect(missingAndroidSplashLogos(root)).toHaveLength(5)
    ensureAndroidSplashLogos(root)
    expect(missingAndroidSplashLogos(root)).toEqual([])
    assertAndroidSplashLogos(root)
  })

  it('fails when the source asset is missing', () => {
    const root = mkdtempSync(join(tmpdir(), 'android-splash-empty-'))
    expect(() => ensureAndroidSplashLogos(root)).toThrow(/splash-logo-square/)
  })
})
