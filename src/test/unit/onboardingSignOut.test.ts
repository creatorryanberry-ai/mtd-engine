import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('onboarding sign out', () => {
  it('signs out immediately from a header button outside the scroll view', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/features/business/BusinessSetupScreen.tsx'),
      'utf-8',
    )

    expect(src).toMatch(/OnboardingSignOutBar onPress=\{\(\) => void logout\(\)\}/)
    expect(src).toMatch(/Pressable as RNPressable/)
    expect(src).toMatch(/pointerEvents="none"/)

    const signOut = src.indexOf('testID="business-setup-sign-out"')
    const scroll = src.lastIndexOf('<KeyboardAwareScrollView')
    expect(signOut).toBeGreaterThan(0)
    expect(scroll).toBeGreaterThan(signOut)
  })

  it('does not send a logged-out user from auth back to home', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'app/(app)/auth/_layout.tsx'),
      'utf-8',
    )

    expect(src).toMatch(/authState\.value/)
  })
})
