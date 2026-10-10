import { afterEach, describe, expect, test } from 'vitest'

import { MTD_ROUTES } from '~/features/mtd/constants'
import {
  allowSettingsNavigation,
  openSettings,
  resetSettingsNavigationForTests,
  setNativeForTests,
  shouldBlockNativeSettingsLanding,
} from '~/features/mtd/mtdNavigationSession'

describe('mtdNavigationSession', () => {
  afterEach(() => {
    resetSettingsNavigationForTests()
  })

  test('blocks native cold start on settings until user opens settings', () => {
    setNativeForTests(true)

    expect(shouldBlockNativeSettingsLanding('/home/settings')).toBe(true)
    allowSettingsNavigation()
    expect(shouldBlockNativeSettingsLanding('/home/settings')).toBe(false)
  })

  test('blocks bare /home on native', () => {
    setNativeForTests(true)

    expect(shouldBlockNativeSettingsLanding('/home')).toBe(true)
    allowSettingsNavigation()
    expect(shouldBlockNativeSettingsLanding(MTD_ROUTES.overview)).toBe(false)
  })

  test('openSettings allows landing before navigating', () => {
    setNativeForTests(true)

    const pushed: string[] = []
    expect(shouldBlockNativeSettingsLanding(MTD_ROUTES.settings)).toBe(true)

    openSettings((href) => {
      pushed.push(href)
    })

    expect(shouldBlockNativeSettingsLanding(MTD_ROUTES.settings)).toBe(false)
    expect(pushed).toEqual([MTD_ROUTES.settings])
  })
})
